/**
 * Waits for the shipped stack to answer.
 *
 * Starts nothing: `tools/shipped-stack/verify.sh` brings the containers up and
 * this project only runs against them. Seeds nothing either — every assertion
 * in this project holds on a **fresh** instance, which is the point. The moment
 * one of them needs a seeded row, it belongs in one of the two client suites
 * instead.
 */
const BASE_URL =
  process.env['STACK_BASE_URL'] ??
  process.env['BASE_URL'] ??
  'http://localhost:8080';

const TIMEOUT_MS = 180_000;

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `The stack at ${BASE_URL} did not answer within ${TIMEOUT_MS / 1000}s ` +
      `(last: ${lastError}). This project does not start it — run ` +
      '`tools/shipped-stack/verify.sh`, which brings the five containers up ' +
      'from an empty volume and then runs this suite.',
  );
}
