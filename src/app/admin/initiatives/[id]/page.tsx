"use client";

import { use } from "react";
import InitiativeDetailsView from "../components/InitiativeDetailsView";

export default function ViewInitiativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <InitiativeDetailsView initiativeId={id} />;
}
