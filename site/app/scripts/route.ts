import { landingPage } from "../landing-page";

// Landing "Scripts Imobiliários": HTML estático com o banner do link (og:image) escolhido no dashboard.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return landingPage(request, "scripts", "scripts-imobiliarios");
}
