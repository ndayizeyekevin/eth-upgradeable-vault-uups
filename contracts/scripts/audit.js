const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function runAudit() {
  console.log("🔍 Running Aderyn Security Audit...");
  
  try {
    // Check if Aderyn is installed
    try {
      execSync("aderyn --version", { stdio: "pipe" });
    } catch (error) {
      console.error("❌ Aderyn not found. Please install it first:");
      console.error("   cargo install aderyn");
      console.error("   Or download from: https://github.com/Cyfrin/aderyn");
      process.exit(1);
    }

    // Run Aderyn audit
    console.log("Running Aderyn on contracts...");
    const auditCommand = `aderyn --root . --output aderyn_report.md`;
    
    try {
      const output = execSync(auditCommand, { 
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe"
      });
      console.log("✅ Audit completed successfully!");
      console.log(output);
    } catch (error) {
      console.log("⚠️  Audit completed with findings:");
      console.log(error.stdout || error.message);
    }

    // Check if report was generated
    const reportPath = path.join(process.cwd(), "aderyn_report.md");
    if (fs.existsSync(reportPath)) {
      console.log("📄 Audit report generated: aderyn_report.md");
      
      // Parse report for critical findings
      const reportContent = fs.readFileSync(reportPath, "utf8");
      
      // Count findings by severity
      const highFindings = (reportContent.match(/## High/g) || []).length;
      const mediumFindings = (reportContent.match(/## Medium/g) || []).length;
      const lowFindings = (reportContent.match(/## Low/g) || []).length;
      
      console.log("\n📊 Audit Summary:");
      console.log(`   High severity: ${highFindings}`);
      console.log(`   Medium severity: ${mediumFindings}`);
      console.log(`   Low severity: ${lowFindings}`);
      
      // Check for specific proxy-related vulnerabilities
      const proxyIssues = [
        "Uninitialized Implementation",
        "Storage Collision",
        "Function Selector Collision",
        "Delegatecall in Loop",
        "Unprotected Initializer"
      ];
      
      console.log("\n🔍 Proxy-specific checks:");
      proxyIssues.forEach(issue => {
        const found = reportContent.toLowerCase().includes(issue.toLowerCase());
        console.log(`   ${issue}: ${found ? "⚠️  FOUND" : "✅ OK"}`);
      });
      
      // Check for DeFi-specific issues
      const defiIssues = [
        "Integer Overflow",
        "Integer Underflow", 
        "Reentrancy",
        "Unchecked Return Value",
        "Timestamp Dependence"
      ];
      
      console.log("\n💰 DeFi-specific checks:");
      defiIssues.forEach(issue => {
        const found = reportContent.toLowerCase().includes(issue.toLowerCase());
        console.log(`   ${issue}: ${found ? "⚠️  FOUND" : "✅ OK"}`);
      });
      
      if (highFindings > 0 || mediumFindings > 0) {
        console.log("\n⚠️  CRITICAL: High or Medium severity issues found!");
        console.log("   Please review and fix these issues before deployment.");
        console.log("   Check aderyn_report.md for detailed information.");
      } else {
        console.log("\n✅ No critical issues found. Safe to proceed with deployment.");
      }
      
    } else {
      console.log("❌ Audit report not found. Check Aderyn installation and permissions.");
    }

  } catch (error) {
    console.error("❌ Audit failed:", error.message);
    process.exit(1);
  }
}

// Create a sample Aderyn configuration
function createAderynConfig() {
  const config = {
    "root": ".",
    "src": "contracts",
    "exclude": ["node_modules", "cache", "artifacts"],
    "output": "aderyn_report.md",
    "no_snippets": false,
    "stdout": false
  };
  
  fs.writeFileSync("aderyn.toml", 
    Object.entries(config)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key} = [${value.map(v => `"${v}"`).join(", ")}]`;
        } else if (typeof value === "string") {
          return `${key} = "${value}"`;
        } else {
          return `${key} = ${value}`;
        }
      })
      .join("\n")
  );
  
  console.log("📝 Created aderyn.toml configuration file");
}

if (require.main === module) {
  createAderynConfig();
  runAudit();
}

module.exports = { runAudit, createAderynConfig };