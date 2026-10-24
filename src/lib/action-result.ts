export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function callServerAction<T>(
  action: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch {
    return {
      success: false,
      error: "No se pudo conectar con el servidor. Revisá tu conexión e intentá otra vez.",
    };
  }
}
