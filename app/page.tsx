import Countdown from "./countdown";
export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "HEIGHT MILLION",
            url: "https://height-million.frosty-okapi-1278.chatgpt.site",
            description:
              "Live Bitcoin block 1,000,000 countdown with a time estimate, remaining blocks, and community events.",
          }),
        }}
      />
      <Countdown />
    </>
  );
}
