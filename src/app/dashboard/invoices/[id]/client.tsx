import Image from "next/image";

type Props = {
  companyProfile?: {
    logo_url?: string;
  };
};

const defaultLogoUrl = "/default-logo.png";

export default function InvoiceLogo({ companyProfile }: Props) {
  return (
    <Image
      src={companyProfile?.logo_url || defaultLogoUrl}
      alt="Company Logo"
      width={150}
      height={60}
    />
  );
}