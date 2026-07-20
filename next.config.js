const nextConfig = {
  serverExternalPackages: ["pdfkit"], // or experimental.serverComponentsExternalPackages, per above
  outputFileTracingIncludes: {
    "/api/daily-log/report": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

module.exports = nextConfig;
