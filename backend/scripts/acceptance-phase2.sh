#!/usr/bin/env bash
# Phase 2 acceptance suite — end-to-end against a real backend + Postgres.
# Idempotent: starts its own backend process on :4000 with a high
# rate-limit budget and TRUNCATEs the DB at start, so back-to-back runs
# produce the same result. Requires:
#   - Postgres reachable at localhost:5432 as user postgres / password postgres
#   - marketplace_dev database existing with the Phase 1 init migration
#   - Categories seeded (npm run seed)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
API=http://localhost:4000/api/v1
SECRET="dev-only-secret-do-not-use-in-prod-replace-immediately-xyz123abc456"
PASS=0
FAIL=0
note() { echo; echo "=== $1 ==="; }
ok() { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# --- self-contained backend: kill anything on :4000 and start fresh with
#     a high rate-limit budget so back-to-back suite runs work cleanly.
#     The in-memory express-rate-limit store keeps state per process, so a
#     fresh process is the cleanest reset. ---
lsof -ti:4000 | xargs kill -9 2>/dev/null
sleep 0.5
(
  cd "$BACKEND_DIR" && \
  RATE_LIMIT_AUTH_MAX=999 LOG_LEVEL=warn npm run dev > /tmp/marketplace-backend-test.log 2>&1 &
)
# Wait for the new instance to come up.
for _ in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null | grep -q 200; then
    break
  fi
  sleep 0.5
done
curl -s -o /dev/null -w "%{http_code}" "$API/health" | grep -q 200 || {
  echo "Backend failed to start. Tail of log:"
  tail -20 /tmp/marketplace-backend-test.log
  exit 2
}

# --- clean slate ---
PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -c "TRUNCATE \"AuditLog\", \"EmailQueue\", \"OrderStatusHistory\", \"OrderItem\", \"Order\", \"CartItem\", \"ProductImage\", \"Product\", \"SupplierProfile\", \"BuyerProfile\", \"User\" CASCADE;" > /dev/null
rm -rf $BACKEND_DIR/uploads/products/* $BACKEND_DIR/uploads/logos/* 2>/dev/null

# --- generate test images ---
node -e "const sharp=require('$REPO_ROOT/node_modules/sharp');Promise.all([sharp({create:{width:1600,height:1200,channels:3,background:{r:200,g:80,b:50}}}).jpeg().toFile('/tmp/p1.jpg'),sharp({create:{width:1024,height:768,channels:3,background:{r:50,g:200,b:100}}}).png().toFile('/tmp/p2.png'),sharp({create:{width:800,height:800,channels:3,background:{r:80,g:80,b:200}}}).webp().toFile('/tmp/p3.webp'),sharp({create:{width:1000,height:1000,channels:3,background:{r:160,g:90,b:160}}}).jpeg().toFile('/tmp/p4.jpg'),sharp({create:{width:900,height:900,channels:3,background:{r:60,g:120,b:90}}}).png().toFile('/tmp/p5.png'),sharp({create:{width:700,height:700,channels:3,background:{r:30,g:30,b:30}}}).jpeg().toFile('/tmp/p6.jpg')]).then(()=>console.log('imgs ok'))"

# --- register two suppliers + a buyer ---
SUP1=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"s1@p2.local","password":"hunter22A","name":"Sup One","role":"SUPPLIER","storeName":"Sup One"}')
SUP1_TOKEN=$(echo "$SUP1" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
SUP1_ID=$(echo "$SUP1" | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['id'])")

SUP2=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"s2@p2.local","password":"hunter22A","name":"Sup Two","role":"SUPPLIER","storeName":"Sup Two"}')
SUP2_TOKEN=$(echo "$SUP2" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
SUP2_ID=$(echo "$SUP2" | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['id'])")

BUYER=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"b@p2.local","password":"hunter22A","name":"Buyer","role":"BUYER"}')
BUYER_TOKEN=$(echo "$BUYER" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

[ -n "$SUP1_TOKEN" ] && [ -n "$SUP2_TOKEN" ] && [ -n "$BUYER_TOKEN" ] && ok "registered 2 suppliers + 1 buyer" || bad "registration failed"

note "Regression chain: register → login → /me (with that token)"
# Plain seconds — date %N is literal on macOS BSD and the Zod transform
# lowercases the email, breaking a case-sensitive grep on the original.
CHAIN_EMAIL="chain-$(date +%s)-$RANDOM@test.local"
REG=$(curl -s -X POST $API/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$CHAIN_EMAIL\",\"password\":\"hunter22A\",\"name\":\"Chain User\",\"role\":\"BUYER\"}" -w "\nCODE:%{http_code}")
REG_BODY=$(echo "$REG" | sed '/^CODE:/d')
REG_CODE=$(echo "$REG" | sed -n 's/^CODE://p')
REG_TOKEN=$(echo "$REG_BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('token',''))")
[ "$REG_CODE" = "201" ] && ok "register → 201" || bad "register HTTP=$REG_CODE body=$REG_BODY"
[ -n "$REG_TOKEN" ] && ok "register returned JWT" || bad "no JWT in register body"

LOG=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$CHAIN_EMAIL\",\"password\":\"hunter22A\"}" -w "\nCODE:%{http_code}")
LOG_CODE=$(echo "$LOG" | sed -n 's/^CODE://p')
[ "$LOG_CODE" = "200" ] && ok "login (same creds) → 200" || bad "login HTTP=$LOG_CODE"

ME=$(curl -s $API/auth/me -H "Authorization: Bearer $REG_TOKEN" -w "\nCODE:%{http_code}")
ME_CODE=$(echo "$ME" | sed -n 's/^CODE://p')
ME_BODY=$(echo "$ME" | sed '/^CODE:/d')
[ "$ME_CODE" = "200" ] && ok "/me with register-token → 200" || bad "/me HTTP=$ME_CODE"
echo "$ME_BODY" | grep -q "$CHAIN_EMAIL" && ok "/me returns the registered email" || bad "/me wrong identity"

CAT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT id FROM \"Category\" WHERE slug='phones';" | xargs)
[ -n "$CAT_ID" ] && ok "category lookup ($CAT_ID)" || bad "category missing — re-run seed"

note "Categories tree endpoint"
TREE=$(curl -s $API/categories)
echo "$TREE" | grep -q '"Electronics"' && ok "Electronics present" || bad "Electronics missing"
echo "$TREE" | grep -q '"Phones"' && ok "Phones nested under Electronics" || bad "Phones missing"

note "Auth/role gates on product create"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/supplier/products -F "name=Phone X" -F "description=description here" -F "categoryId=$CAT_ID" -F "price=99" -F "stock=1" -F "images=@/tmp/p1.jpg")
[ "$CODE" = "401" ] && ok "no auth → 401" || bad "expected 401, got $CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API/supplier/products -H "Authorization: Bearer $BUYER_TOKEN" -F "name=Phone X" -F "description=description here" -F "categoryId=$CAT_ID" -F "price=99" -F "stock=1" -F "images=@/tmp/p1.jpg")
[ "$CODE" = "403" ] && ok "buyer → 403" || bad "expected 403, got $CODE"

note "Validation: no images"
R=$(curl -s -X POST $API/supplier/products -H "Authorization: Bearer $SUP1_TOKEN" -F "name=No Images" -F "description=valid description here" -F "categoryId=$CAT_ID" -F "price=10" -F "stock=1")
echo "$R" | grep -q '"code":"VALIDATION_ERROR"' && echo "$R" | grep -q 'At least one image' && ok "0-images → 400 VALIDATION_ERROR" || bad "0-images guard"

note "Validation: 6 images"
R=$(curl -s -X POST $API/supplier/products -H "Authorization: Bearer $SUP1_TOKEN" -F "name=Too Many" -F "description=valid description here" -F "categoryId=$CAT_ID" -F "price=10" -F "stock=1" -F "images=@/tmp/p1.jpg" -F "images=@/tmp/p2.png" -F "images=@/tmp/p3.webp" -F "images=@/tmp/p4.jpg" -F "images=@/tmp/p5.png" -F "images=@/tmp/p6.jpg")
# Multer rejects above limit. Multer error path returns its own message; either way we expect non-201.
CODE=$(echo "$R" | grep -c '"product"')
[ "$CODE" = "0" ] && ok "6 images rejected" || bad "6 images accepted"

note "Create product with 3 images"
R=$(curl -s -X POST $API/supplier/products -H "Authorization: Bearer $SUP1_TOKEN" -F "name=iPhone 15" -F "description=A fine smartphone for testing the marketplace" -F "categoryId=$CAT_ID" -F "price=799.50" -F "stock=25" -F "images=@/tmp/p1.jpg" -F "images=@/tmp/p2.png" -F "images=@/tmp/p3.webp")
PID=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['product']['id'])" 2>/dev/null)
[ -n "$PID" ] && ok "created product ($PID)" || bad "create failed: $R"

# Verify file count: 3 originals + 3 thumbs = 6 webp files
COUNT=$(ls $BACKEND_DIR/uploads/products/*.webp 2>/dev/null | wc -l | xargs)
[ "$COUNT" = "6" ] && ok "3 originals + 3 thumbs on disk ($COUNT files)" || bad "expected 6 files, got $COUNT"

# Image URL accessible
IMG_URL=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['product']['images'][0]['url'])")
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$IMG_URL)
[ "$CODE" = "200" ] && ok "image served at $IMG_URL" || bad "image not served"
# And the thumb variant
THUMB_URL=$(echo "$IMG_URL" | sed 's/\.webp$/-thumb.webp/')
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$THUMB_URL)
[ "$CODE" = "200" ] && ok "thumb served at $THUMB_URL" || bad "thumb not served"

note "Slug collision suffix"
R2=$(curl -s -X POST $API/supplier/products -H "Authorization: Bearer $SUP1_TOKEN" -F "name=iPhone 15" -F "description=Another product with the same name" -F "categoryId=$CAT_ID" -F "price=899" -F "stock=10" -F "images=@/tmp/p1.jpg")
SLUG=$(echo "$R2" | python3 -c "import sys,json;print(json.load(sys.stdin)['product']['slug'])")
[ "$SLUG" = "iphone-15-2" ] && ok "second 'iPhone 15' → $SLUG" || bad "unexpected slug: $SLUG"

note "Concurrent slug collisions (5 parallel POSTs, same name)"
for i in 1 2 3 4 5; do
  (curl -s -X POST $API/supplier/products -H "Authorization: Bearer $SUP1_TOKEN" -F "name=Race Brand" -F "description=Concurrent race acceptance check" -F "categoryId=$CAT_ID" -F "price=10" -F "stock=1" -F "images=@/tmp/p1.jpg" -o /tmp/race-$i.json) &
done
wait
SLUGS=$(for i in 1 2 3 4 5; do
  python3 -c "import sys,json;d=json.load(open('/tmp/race-$i.json'));print(d.get('product',{}).get('slug','ERR_'+d.get('code','?')))"
done | sort -u | wc -l | xargs)
[ "$SLUGS" = "5" ] && ok "5 concurrent creates → 5 distinct slugs" || bad "concurrent slugs: $SLUGS distinct values"
for i in 1 2 3 4 5; do
  CODE=$(python3 -c "import sys,json;d=json.load(open('/tmp/race-$i.json'));print('OK' if 'product' in d else d.get('code','ERR'))")
  [ "$CODE" = "OK" ] || bad "race attempt $i errored: $CODE"
done
[ "$FAIL" = "0" ] && ok "no race attempt returned an error" || true

note "Update product → audit captures only changed fields"
U=$(curl -s -X PATCH $API/supplier/products/$PID -H "Authorization: Bearer $SUP1_TOKEN" -H 'Content-Type: application/json' -d '{"price":"850.00","stock":30}')
CHANGED=$(echo "$U" | python3 -c "import sys,json;print(','.join(json.load(sys.stdin)['changed']))")
[ "$CHANGED" = "price,stock" ] && ok "changed = [price, stock]" || bad "changed=$CHANGED"
AUDIT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT metadata::text FROM \"AuditLog\" WHERE action='PRODUCT_UPDATED' AND \"entityId\"='$PID' ORDER BY \"createdAt\" DESC LIMIT 1;")
echo "$AUDIT" | grep -q 'price' && echo "$AUDIT" | grep -q 'stock' && ok "audit metadata records the diff" || bad "audit metadata missing"

note "Cross-supplier 403 on update"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH $API/supplier/products/$PID -H "Authorization: Bearer $SUP2_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Hijacked"}')
[ "$CODE" = "403" ] && ok "sup2 → 403 on sup1 product" || bad "expected 403, got $CODE"

note "active toggle"
curl -s -X PATCH $API/supplier/products/$PID -H "Authorization: Bearer $SUP1_TOKEN" -H 'Content-Type: application/json' -d '{"active":false}' > /dev/null
ACTIVE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT active FROM \"Product\" WHERE id='$PID';")
[ "$ACTIVE" = "f" ] && ok "delisted (active=false)" || bad "active still $ACTIVE"
curl -s -X PATCH $API/supplier/products/$PID -H "Authorization: Bearer $SUP1_TOKEN" -H 'Content-Type: application/json' -d '{"active":true}' > /dev/null

note "Image add + remove"
ADD=$(curl -s -X POST $API/supplier/products/$PID/images -H "Authorization: Bearer $SUP1_TOKEN" -F "images=@/tmp/p4.jpg")
echo "$ADD" | grep -q '"added"' && ok "image added" || bad "add failed: $ADD"
IMG_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT COUNT(*) FROM \"ProductImage\" WHERE \"productId\"='$PID';")
[ "$IMG_COUNT" = "4" ] && ok "image count is now 4" || bad "expected 4 images, got $IMG_COUNT"

# Remove an image and verify file gone
IMG_TO_DELETE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT id FROM \"ProductImage\" WHERE \"productId\"='$PID' ORDER BY \"order\" DESC LIMIT 1;")
IMG_URL_DEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT url FROM \"ProductImage\" WHERE id='$IMG_TO_DELETE';")
curl -s -X DELETE $API/supplier/products/$PID/images/$IMG_TO_DELETE -H "Authorization: Bearer $SUP1_TOKEN" > /dev/null
test ! -f "$BACKEND_DIR$IMG_URL_DEL" && ok "removed image file gone from disk" || bad "image file not cleaned"

note "Cannot remove last image"
# Bring stock down to 1 image first
WHILE_IDS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT id FROM \"ProductImage\" WHERE \"productId\"='$PID' ORDER BY \"order\";" | head -2)
for id in $WHILE_IDS; do
  curl -s -X DELETE $API/supplier/products/$PID/images/$id -H "Authorization: Bearer $SUP1_TOKEN" > /dev/null
done
LAST_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT id FROM \"ProductImage\" WHERE \"productId\"='$PID';" | head -1)
R=$(curl -s -X DELETE $API/supplier/products/$PID/images/$LAST_ID -H "Authorization: Bearer $SUP1_TOKEN")
echo "$R" | grep -q '"CONFLICT"' && ok "last-image deletion blocked (409)" || bad "expected 409, got $R"

note "Hard delete (no orders) removes files + DB row"
# Remember files that existed before delete
DEL_PID=$(echo "$R2" | python3 -c "import sys,json;print(json.load(sys.stdin)['product']['id'])")
PRE_COUNT=$(ls $BACKEND_DIR/uploads/products/*.webp 2>/dev/null | wc -l | xargs)
RES=$(curl -s -X DELETE $API/supplier/products/$DEL_PID -H "Authorization: Bearer $SUP1_TOKEN")
echo "$RES" | grep -q '"mode":"hard"' && ok "deleted in hard mode" || bad "delete mode: $RES"
POST_COUNT=$(ls $BACKEND_DIR/uploads/products/*.webp 2>/dev/null | wc -l | xargs)
[ "$POST_COUNT" -lt "$PRE_COUNT" ] && ok "files cleaned up (pre=$PRE_COUNT post=$POST_COUNT)" || bad "files not cleaned"
GONE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT COUNT(*) FROM \"Product\" WHERE id='$DEL_PID';")
[ "$GONE" = "0" ] && ok "product row gone" || bad "still in DB"

note "Soft delete simulated (orders referenced)"
# Insert a synthetic order item referencing $PID, then try delete — should soft-delete
PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev <<SQL > /dev/null
INSERT INTO "Order" (id, "orderNumber", "buyerId", status, "totalAmount", "shippingAddress", "createdAt", "updatedAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'ORD-2026-99999',
  (SELECT id FROM "User" WHERE email='b@p2.local'),
  'PAID', '50.00', '{"name":"x"}'::jsonb, now(), now());
INSERT INTO "OrderItem" (id, "orderId", "productId", "supplierId", "productName", "productPrice", quantity)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
  '$PID', '$SUP1_ID', 'iPhone 15', '799.50', 1);
SQL
RES=$(curl -s -X DELETE $API/supplier/products/$PID -H "Authorization: Bearer $SUP1_TOKEN")
echo "$RES" | grep -q '"mode":"soft"' && ok "referenced product → soft delete" || bad "expected soft, got: $RES"
ACTIVE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT active FROM \"Product\" WHERE id='$PID';")
[ "$ACTIVE" = "f" ] && ok "product remains but is inactive" || bad "still active"

note "Dashboard stats"
DASH=$(curl -s $API/supplier/dashboard -H "Authorization: Bearer $SUP1_TOKEN")
TP=$(echo "$DASH" | python3 -c "import sys,json;print(json.load(sys.stdin)['totalProducts'])")
TO=$(echo "$DASH" | python3 -c "import sys,json;print(json.load(sys.stdin)['totalOrders'])")
DB_PROD=$(PGPASSWORD=postgres psql -h localhost -U postgres -d marketplace_dev -tA -c "SELECT COUNT(*) FROM \"Product\" WHERE \"supplierId\"='$SUP1_ID';")
echo "  totalProducts=$TP totalOrders=$TO db_count=$DB_PROD"
[ "$TP" = "$DB_PROD" ] && ok "totalProducts matches DB ($TP)" || bad "totalProducts=$TP, DB=$DB_PROD"
[ "$TO" = "1" ] && ok "totalOrders=1 (synthetic order counted)" || bad "totalOrders=$TO"

note "Profile update + logo round-trip"
node -e "const sharp=require('$REPO_ROOT/node_modules/sharp');sharp({create:{width:800,height:800,channels:3,background:{r:255,g:200,b:50}}}).png().toFile('/tmp/logo.png').then(()=>console.log('logo ok'))"
PUP=$(curl -s -X PATCH $API/supplier/profile -H "Authorization: Bearer $SUP1_TOKEN" -F "storeName=Updated Sup One" -F "description=Now with description" -F "logo=@/tmp/logo.png")
echo "$PUP" | grep -q '"storeName":"Updated Sup One"' && ok "storeName updated" || bad "storeName update failed"
LOGO_URL=$(echo "$PUP" | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['logoUrl'])")
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000$LOGO_URL)
[ "$CODE" = "200" ] && ok "logo served" || bad "logo not served"

echo
echo "================================================"
echo "  PHASE 2 — PASS: $PASS    FAIL: $FAIL"
echo "================================================"
exit $FAIL
