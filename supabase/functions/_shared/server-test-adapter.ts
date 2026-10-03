export let handler: (request: Request) => Promise<Response>;
export function serve(callback: (request: Request) => Promise<Response>) {
  handler = callback;
}
