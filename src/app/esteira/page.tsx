import { redirect } from "next/navigation";

// O módulo "Esteira" agora se chama "Agentes".
export default function EsteiraRedirect() {
  redirect("/agentes");
}
