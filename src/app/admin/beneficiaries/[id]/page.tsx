"use client";

import { use } from "react";
import BeneficiaryDetailsView from "../components/BeneficiaryDetailsView";

export default function ViewBeneficiary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <BeneficiaryDetailsView beneficiaryId={id} />;
}
