import { redirect } from "next/navigation";

export default function EnquiriesInboxPage() {
  redirect("/clients?orderState=without_orders");
}
