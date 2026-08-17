import Link from "next/link";
import type { DuplicateMatch } from "@/lib/enquiries/duplicate-match";

export function DuplicateWarning({ matches }: { matches: DuplicateMatch[] }) {
  if (!matches.length) return null;

  return (
    <div className="mt-6 rounded-[0.8rem] border border-[#d9aaa7] bg-[#f7e5e3] p-4">
      <p className="text-sm font-semibold text-kuartz-danger">Possible existing contacts found</p>
      <p className="mt-1 text-sm text-kuartz-danger">
        Review these before converting this Enquiry. If this is the same person, attach the Enquiry to the existing
        Client instead of creating a new Client.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-kuartz-danger">
        {matches.map((match) => {
          const href =
            match.candidate.kind === "client"
              ? `/clients/${match.candidate.id}`
              : `/enquiries/${match.candidate.id}`;
          const reason =
            match.reason === "phone"
              ? "same phone number"
              : match.reason === "email"
                ? "same email address"
                : match.reason === "exact_name"
                  ? "same name"
                  : "similar name";

          return (
            <li key={`${match.candidate.kind}-${match.candidate.id}`}>
              <Link href={href} className="font-semibold underline underline-offset-4">
                {match.candidate.fullName}
              </Link>{" "}
              - {match.candidate.primaryPhone}
              {match.candidate.email ? ` - ${match.candidate.email}` : ""} - {reason} (
              {match.candidate.kind === "client" ? "Client" : "Enquiry"})
            </li>
          );
        })}
      </ul>
    </div>
  );
}
