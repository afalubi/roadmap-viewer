import { redirect } from "next/navigation";

export default function UnplannedPage() {
  redirect("/?mode=unplanned");
}
