import { api } from "@/lib/api/helpers";

export const GET = api({
  methods: ["GET"],
  auth: "optional",
  handler: async ({ user }) => {
    return Response.json({ success: true, data: { user } });
  },
});
