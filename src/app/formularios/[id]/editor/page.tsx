"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useGlobalStore } from "@/store";
import { FormEditor } from "./_components/FormEditor";

// Ativa canvasMode ao montar (oculta Dock + remove padding do AuthLayout)
// e desativa ao desmontar para restaurar o layout normal.
export default function FormularioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const setCanvasMode = useGlobalStore(s => s.setCanvasMode);

  useEffect(() => {
    setCanvasMode(true);
    return () => setCanvasMode(false);
  }, [setCanvasMode]);

  return <FormEditor id={id} />;
}
