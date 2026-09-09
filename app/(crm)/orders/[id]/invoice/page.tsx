import { OrderPaymentsWorkspace } from "@/components/orders/invoice-workspace";

export default async function OrderInvoicePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  return <OrderPaymentsWorkspace orderId={id} error={error} />;
}
