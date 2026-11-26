import { landingPage } from "../landing-page";

// Landing "Guia do Impulsionar" (genesycompany.com/impulsionar).
// HTML estático com o banner do link (og:image) escolhido no dashboard.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return landingPage(request, "impulsionar", "guia-impulsionar");
}
