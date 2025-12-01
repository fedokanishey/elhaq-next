import { use } from "react";
import InitiativeDetailsClient from "./viewer";

export const dynamic = "force-dynamic";

export default function InitiativeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return <InitiativeDetailsClient initiativeId={resolvedParams.id} />;
}
