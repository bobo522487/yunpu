export type LogFields = {
  event: string;
  request_id?: string;
  user_id?: string;
  organization_id?: string;
  result?: string;
  reason?: string;
  [key: string]: unknown;
};

export function logEvent(fields: LogFields): void {
  console.log(JSON.stringify(fields));
}
