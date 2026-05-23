import type {
  CategoryNode,
  OrderStatus,
  SupplierProfileResponse,
} from "@marketplace/shared";
import { apiFetch, getStoredToken } from "./api";
import { env } from "./env";

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingShipments: number;
  revenue: { allTime: string; last30Days: string };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      productPrice: string;
      shippedAt: string | null;
    }>;
  }>;
}

export const fetchDashboard = () =>
  apiFetch<DashboardStats>("/supplier/dashboard");

export const fetchProfile = () =>
  apiFetch<{ profile: SupplierProfileResponse }>("/supplier/profile");

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: number;
  active: boolean;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  images: Array<{ id: string; url: string; order: number }>;
}

export interface ProductDetail extends ProductSummary {
  supplierId: string;
  categoryId: string;
}

export const fetchProducts = (page = 1, limit = 20) =>
  apiFetch<{
    data: ProductSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/supplier/products?page=${page}&limit=${limit}`);

export const fetchProduct = (id: string) =>
  apiFetch<{ product: ProductDetail }>(`/supplier/products/${id}`);

export const fetchCategories = () =>
  apiFetch<{ categories: CategoryNode[] }>("/categories", { token: null });

interface ProductFormInput {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  stock: string;
}

const buildProductFormData = (
  input: ProductFormInput,
  images: File[],
): FormData => {
  const fd = new FormData();
  fd.append("name", input.name);
  fd.append("description", input.description);
  fd.append("categoryId", input.categoryId);
  fd.append("price", input.price);
  fd.append("stock", input.stock);
  for (const file of images) {
    fd.append("images", file);
  }
  return fd;
};

/**
 * Multipart endpoints cannot reuse apiFetch (which always JSON-stringifies),
 * so we hit the API directly here with the same error-envelope handling.
 */
const multipartRequest = async <T,>(
  path: string,
  method: "POST" | "PATCH",
  body: FormData,
): Promise<T> => {
  const token = getStoredToken();
  const res = await fetch(`${env.API_URL}${path}`, {
    method,
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as {
      error?: string;
      code?: string;
      details?: Array<{ field: string; message: string }>;
    };
    const message = err.error ?? `Request failed (${res.status})`;
    const code = err.code ?? "UNKNOWN_ERROR";
    const e: Error & { code?: string; status?: number; details?: unknown } =
      new Error(message);
    e.code = code;
    e.status = res.status;
    e.details = err.details;
    throw e;
  }
  return data as T;
};

export const createProduct = (
  input: ProductFormInput,
  images: File[],
): Promise<{ product: ProductDetail }> =>
  multipartRequest(
    "/supplier/products",
    "POST",
    buildProductFormData(input, images),
  );

export const updateProduct = (
  id: string,
  input: Partial<ProductFormInput> & { active?: boolean },
): Promise<{ product: ProductDetail; changed: string[] }> =>
  apiFetch(`/supplier/products/${id}`, { method: "PATCH", body: input });

export const deleteProduct = (id: string) =>
  apiFetch<{ deleted: true; mode: "soft" | "hard" }>(
    `/supplier/products/${id}`,
    { method: "DELETE" },
  );

export const addProductImages = (id: string, images: File[]) => {
  const fd = new FormData();
  for (const f of images) fd.append("images", f);
  return multipartRequest<{ added: Array<{ url: string }> }>(
    `/supplier/products/${id}/images`,
    "POST",
    fd,
  );
};

export const removeProductImage = (id: string, imageId: string) =>
  apiFetch<{ removed: true }>(
    `/supplier/products/${id}/images/${imageId}`,
    { method: "DELETE" },
  );

export const updateProfile = (
  fields: { storeName?: string; description?: string },
  logo?: File | null,
): Promise<{ profile: SupplierProfileResponse; changed: string[] }> => {
  const fd = new FormData();
  if (fields.storeName !== undefined) fd.append("storeName", fields.storeName);
  if (fields.description !== undefined)
    fd.append("description", fields.description);
  if (logo) fd.append("logo", logo);
  return multipartRequest("/supplier/profile", "PATCH", fd);
};
