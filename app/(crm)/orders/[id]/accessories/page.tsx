import { OrderAccessoriesWorkspace } from "@/components/orders/accessories-workspace";

export default async function OrderAccessoriesPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  return <OrderAccessoriesWorkspace orderId={id} error={error} />;
}
