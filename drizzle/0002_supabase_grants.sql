GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT SELECT ON TABLE "organizations" TO "authenticated";
GRANT SELECT ON TABLE "staff_profiles" TO "authenticated";
GRANT UPDATE ("full_name", "updated_at") ON TABLE "staff_profiles" TO "authenticated";
GRANT SELECT ON TABLE "organization_memberships" TO "authenticated";
GRANT SELECT ON TABLE "audit_entries" TO "authenticated";
