export class AppDataRequestError extends Error {
  constructor(readonly status: number) {
    super("No se pudieron actualizar los datos.");
    this.name = "AppDataRequestError";
  }
}
