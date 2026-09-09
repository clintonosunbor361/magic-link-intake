import { OrderFittingsWorkspace } from "@/components/orders/fittings-workspace";

export default async function OrderFittingsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  return <OrderFittingsWorkspace orderId={id} error={error} />;
}
