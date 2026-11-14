export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type ApiEnv = {
  Variables: {
    user: SessionUser | null;
    requestId: string;
  };
};
