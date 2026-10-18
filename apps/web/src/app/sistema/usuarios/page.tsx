import type { Metadata } from "next";
import { Usuarios } from "@/components/sistema/usuarios/usuarios";

export const metadata: Metadata = { title: "Usuários" };

export default function UsuariosPage() {
  return <Usuarios />;
}
