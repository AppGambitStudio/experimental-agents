# Deep Agent for Cloud Cost Optimization (AWS) — Research Document

## Overview

This document outlines how to build a **Cloud Cost Optimization Agent** using the **Claude Agent SDK**. Unlike the hundreds of FinOps dashboards that tell you what's wrong, this agent **investigates, reasons, and executes**. It operates across AWS Organizations (multi-account, multi-region), investigates cost spikes by correlating Cost Explorer with CloudTrail and CloudWatch, detects and cleans up waste, rightsizes instances with automated rollback, optimizes Savings Plans, schedules dev/staging environments, and analyzes data transfer costs — all through a tiered autonomy model where trust is earned, not assumed. Every existing FinOps tool stops at "here's a recommendation." This agent starts there.

**Target users:** DevOps/SRE teams, FinOps practitioners, Cloud architects, Managed services teams.

**Target customers:** AWS-native companies, Managed services providers (ScaleCapacity), any organization spending ₹5L+/month on AWS.

---

## 1. Why This Agent Is Needed

### The Problem

AWS cost management is broken despite a crowded tool landscape:

| Pain Point | Detail |
|------------|--------|
| **Recommendation fatigue** | AWS Trusted Advisor + Compute Optimizer + third-party tools generate hundreds of recommendations. Teams have 847 unactioned items because nobody has time to evaluate and execute each one. |
| **Investigation is manual** | "Why did our bill spike 40%?" requires logging into Cost Explorer, filtering by service, drilling into accounts, checking CloudTrail for deployments, correlating with CloudWatch metrics — a 2-hour detective job every time. |
| **Execution gap** | Every tool says "this RDS is oversized." Nobody says "I'll resize it for you at 2am, monitor health checks, and rollback if anything breaks." The last mile — from recommendation to action — is 100% manual. |
| **Context-blind recommendations** | Tools don't know if a resource is production-critical or a forgotten test instance. They rank by dollar savings, not by risk-adjusted business impact. |
| **Tag discipline dependency** | FinOps platforms fall apart without consistent tagging. Real accounts have 40-60% untagged resources — garbage in, garbage out. |
| **Multi-account complexity** | Organizations with 10-50 accounts can't easily see cross-account patterns, orphaned resources in forgotten accounts, or regional sprawl. |
| **Dev/staging waste** | Development environments run 24/7 but are used 40-50 hours/week. Nobody sets up the stop/start schedules because it's tedious per-instance configuration. |
| **Data transfer surprise** | NAT Gateway, cross-AZ, and cross-region transfer costs are invisible until the bill arrives. Often 15-25% of total spend. |
| **Savings Plan analysis paralysis** | 1yr vs 3yr, all-upfront vs no-upfront, compute vs EC2 vs SageMaker — too many options, too much risk of over-commitment. Teams delay and keep paying on-demand. |

### What Existing Tools Do vs. What This Agent Does

| Capability | Existing Tools (Cost Explorer, CloudHealth, etc.) | This Agent |
|-----------|--------------------------------------------------|------------|
| Show cost breakdown | ✅ Dashboard | ✅ Conversational: "What's burning money in dev?" |
| Detect anomalies | ✅ Alert: "Cost up 40%" | ✅ Investigate: "Cost up 40% because 8 load-test instances left running since Mar 12 by CI/CD pipeline, currently at 0.3% CPU" |
| Rightsizing recommendations | ✅ List: "847 recommendations" | ✅ Prioritized: "Top 5 by savings × safety. #1 saves ₹18K/mo, it's a dev instance, zero risk" |
| Execute changes | ❌ You do it | ✅ "Resized at 2am, health checks passed, saving ₹18K/mo. Here's the before/after." |
| Handle untagged resources | ❌ "Please tag your resources" | ✅ Infers ownership from CloudFormation stacks, VPC placement, CloudTrail creator, naming patterns |
| Schedule dev environments | ❌ Manual EventBridge setup | ✅ "Detected 24 dev instances used Mon-Fri 9-8. Created stop/start schedules. Saving ₹2.7L/mo." |
| Multi-account visibility | ✅ Dashboard per account | ✅ Cross-account investigation: "Your staging account has ₹3.2L of waste across 4 regions" |
| Data transfer analysis | ⚠️ High-level line item | ✅ "18TB through NAT because ECS pulls from ECR without VPC endpoint. Creating endpoint saves ₹75K/mo." |

### Why Claude Agent SDK

The Agent SDK is ideal because cost optimization requires:
- **Multi-step reasoning** — investigating a cost spike requires 5-10 sequential API calls with each step informed by the previous
- **MCP tool architecture** — domain-specific tools wrapping AWS SDK calls, composable into investigation chains
- **Multi-model orchestration** — Opus for complex cost analysis and savings plan modeling, Sonnet for resource scanning and report generation, Haiku for metric lookups and simple checks
- **Human-in-the-loop** — tiered autonomy with approval gates for risky and production changes
- **Context accumulation** — agent builds understanding of the customer's account structure, naming conventions, and patterns over time

---

## 2. Architecture

### High-Level Design

```
                    ┌───────────────────────────────────────┐
                    │   Cloud Cost Optimization Agent        │
                    │        (Orchestrator)                  │
                    │                                        │
                    │   Claude Agent SDK + 3 MCP Servers     │
                    └──────────────┬────────────────────────┘
                                   │
         ┌───────────┬─────────────┼─────────────┬────────────┐
         │           │             │             │            │
   ┌─────▼─────┐ ┌──▼──────┐ ┌───▼────┐ ┌──────▼─────┐ ┌───▼────────┐
   │ Cost      │ │ Waste   │ │ Right- │ │ Savings   │ │ Scheduled  │
   │ Investig- │ │ Detector│ │ sizing │ │ Plan      │ │ Scaling    │
   │ ator      │ │ & Clean │ │ Engine │ │ Optimizer │ │ Engine     │
   └─────┬─────┘ └──┬──────┘ └───┬────┘ └──────┬─────┘ └───┬────────┘
         │           │            │             │            │
   ┌─────▼───────────▼────────────▼─────────────▼────────────▼──┐
   │                    3 MCP Servers                            │
   │                                                             │
   │  aws-cost-mcp          aws-resource-mcp     aws-action-mcp │
   │  (Cost Explorer,       (EC2, RDS, EBS,      (Execute       │
   │   CloudTrail,          S3, ELB, NAT,        changes with   │
   │   Billing,             CloudWatch           audit trail    │
   │   Organizations)       metrics)             + rollback)    │
   └──────────────────────────┬──────────────────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │    AWS Organizations        │
               │                              │
               │  ┌──────────────────────┐   │
               │  │ Management Account   │   │
               │  │ (AssumeRole hub)     │   │
               │  └──────────┬───────────┘   │
               │       ┌─────┼─────┐         │
               │  ┌────▼──┐ ┌▼────┐ ┌▼─────┐ │
               │  │ Prod  │ │ Dev │ │Stag. │ │
               │  │Account│ │Acct │ │Account│ │
               │  └───────┘ └─────┘ └──────┘ │
               │    (×N accounts, ×M regions) │
               └──────────────────────────────┘
```

### Multi-Account, Multi-Region Access Pattern

```
Agent (runs with CostOptimizerRole in management account)
  │
  ├── sts:AssumeRole → CostOptimizerReadRole in Account A
  │     └── ec2:DescribeRegions → [us-east-1, ap-south-1, eu-west-1]
  │           ├── us-east-1: scan resources in parallel
  │           ├── ap-south-1: scan resources in parallel
  │           └── eu-west-1: scan resources in parallel
  │
  ├── sts:AssumeRole → CostOptimizerReadRole in Account B
  │     └── (same multi-region scan)
  │
  └── Cost Explorer (global, from management account)
        └── Aggregated cost data across all accounts
```

Key design points:
- **Cost data is global** — Cost Explorer queries from management account see all accounts
- **Resource data is regional** — must scan each enabled region per account
- **Parallel scanning** — all regions within an account scanned concurrently, all accounts scanned concurrently
- **Two IAM roles** — `CostOptimizerReadRole` (all accounts) and `CostOptimizerWriteRole` (only L2/L3 accounts)

### Tiered Autonomy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LEVELS (per account)                 │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 1  │  Agent: Observe & Recommend                          │
│ (Trust   │  ──────────────────────────────────────────          │
│  building│  Full read access. Agent investigates, analyzes,     │
│  phase)  │  and produces recommendations with savings           │
│          │  estimates. All actions are proposals only.           │
│          │  Output: Cost Health Report + prioritized actions.    │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Auto-Execute Safe, Approve Risky             │
│ (Proven  │  ──────────────────────────────────────────          │
│  trust)  │  Auto-executes reversible, non-production actions:   │
│          │  stop idle dev instances, delete unattached EBS,     │
│          │  release unused EIPs, create stop/start schedules,   │
│          │  tag resources, create VPC endpoints.                │
│          │  Human approval for: production changes, resizing,   │
│          │  snapshot deletion, any irreversible action.         │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Auto-Execute Most, Approve Critical          │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Auto-executes: rightsizing (with rollback),         │
│          │  S3 lifecycle policies, stale snapshot cleanup,      │
│          │  schedule creation, dev environment management.      │
│          │  Human approval for: production instance changes,    │
│          │  RDS deletion, Savings Plan purchases, any action    │
│          │  on protected/compliance-locked resources.           │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⛔ NEVER AUTO-EXECUTED (regardless of level)         │
│ LEVELS   │  - Terminate running production instances             │
│          │  - Delete RDS databases / S3 buckets with data       │
│          │  - Purchase Savings Plans / Reserved Instances        │
│          │  - Modify IAM roles or security groups               │
│          │  - Any action on `protected` or `compliance-locked`  │
│          │    tagged resources                                  │
│          │  - Any action on accounts marked `critical`          │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 3. Account Onboarding

### Onboarding Flow

```
┌────────────────────────────────────────────────────────────────┐
│                  ACCOUNT ONBOARDING FLOW                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  STEP 1: DevOps deploys IAM roles (one-time, ~15 min)         │
│  ┌──────────────────────────────────────────────────┐         │
│  │ Option A: CloudFormation StackSet (recommended)   │         │
│  │   → One command deploys to all Org accounts       │         │
│  │                                                    │         │
│  │ Option B: Terraform module                         │         │
│  │   → For teams using Terraform                     │         │
│  │                                                    │         │
│  │ Option C: Manual IAM role per account              │         │
│  │   → For single-account or gradual rollout         │         │
│  └──────────────────────────────────────────────────┘         │
│                         │                                      │
│  STEP 2: Agent auto-discovers account structure               │
│  ┌──────────────────────────────────────────────────┐         │
│  │ • Organization tree + account names/tags          │         │
│  │ • Enabled regions per account                     │         │
│  │ • Existing cost allocation tags                   │         │
│  │ • Existing Savings Plans / RIs                    │         │
│  │ • Billing currency and preferences                │         │
│  └──────────────────────────────────────────────────┘         │
│                         │                                      │
│  STEP 3: Agent runs initial Cost Health Assessment            │
│  ┌──────────────────────────────────────────────────┐         │
│  │ • 90-day cost history analysis                    │         │
│  │ • Full resource inventory across all accounts     │         │
│  │ • Waste detection scan                            │         │
│  │ • Savings opportunity identification              │         │
│  │ • Data transfer pattern analysis                  │         │
│  │ • Tag coverage assessment                         │         │
│  │ → Generates "Cost Health Report"                  │         │
│  └──────────────────────────────────────────────────┘         │
│                         │                                      │
│  STEP 4: Team reviews, configures autonomy                    │
│  ┌──────────────────────────────────────────────────┐         │
│  │ • Review Cost Health Report                       │         │
│  │ • Set autonomy level per account (L1/L2/L3)       │         │
│  │ • Mark protected accounts/resources               │         │
│  │ • Configure notification channels                 │         │
│  │ • Set maintenance windows for prod changes        │         │
│  └──────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────┘
```

### IAM Role: CostOptimizerReadRole

Deployed to ALL accounts in the Organization:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CostAnalysis",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast",
        "ce:GetReservationUtilization",
        "ce:GetSavingsPlansUtilization",
        "ce:GetSavingsPlansPurchaseRecommendation",
        "ce:GetRightsizingRecommendation",
        "ce:GetAnomalies",
        "ce:GetTags",
        "budgets:ViewBudget",
        "budgets:DescribeBudgets",
        "cur:DescribeReportDefinitions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ResourceDiscovery",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "rds:ListTagsForResource",
        "elasticloadbalancing:Describe*",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:GetMetricsConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:GetBucketPolicy",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:ListTags",
        "ecs:List*",
        "ecs:Describe*",
        "eks:List*",
        "eks:Describe*",
        "elasticache:Describe*",
        "es:Describe*",
        "es:ListTags",
        "redshift:Describe*",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:ListTagsOfResource",
        "autoscaling:Describe*",
        "elasticbeanstalk:Describe*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Metrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:DescribeAlarms",
        "logs:DescribeLogGroups",
        "logs:GetLogGroupFields"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AuditAndContext",
      "Effect": "Allow",
      "Action": [
        "cloudtrail:LookupEvents",
        "cloudformation:ListStacks",
        "cloudformation:DescribeStacks",
        "cloudformation:ListStackResources",
        "cloudformation:GetTemplate",
        "tag:GetResources",
        "tag:GetTagKeys",
        "tag:GetTagValues",
        "organizations:ListAccounts",
        "organizations:DescribeOrganization",
        "organizations:DescribeAccount",
        "organizations:ListTagsForResource",
        "iam:ListAccountAliases",
        "sts:GetCallerIdentity",
        "savingsplans:DescribeSavingsPlans",
        "ec2:DescribeRegions"
      ],
      "Resource": "*"
    }
  ]
}
```

### IAM Role: CostOptimizerWriteRole

Deployed ONLY to accounts with L2 or L3 autonomy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2SafeActions",
      "Effect": "Allow",
      "Action": [
        "ec2:StopInstances",
        "ec2:StartInstances",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:ModifyInstanceAttribute",
        "ec2:CreateSnapshot",
        "ec2:DeleteVolume",
        "ec2:DeleteSnapshot",
        "ec2:ReleaseAddress",
        "ec2:DeregisterImage",
        "ec2:CreateVpcEndpoint",
        "ec2:ModifyVpcEndpoint"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:ResourceTag/CostOptimizer": "protected"
        }
      }
    },
    {
      "Sid": "EC2TerminateWithExplicitTag",
      "Effect": "Allow",
      "Action": [
        "ec2:TerminateInstances"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/CostOptimizer": "approved-for-termination"
        }
      }
    },
    {
      "Sid": "RDSActions",
      "Effect": "Allow",
      "Action": [
        "rds:ModifyDBInstance",
        "rds:StopDBInstance",
        "rds:StartDBInstance",
        "rds:CreateDBSnapshot",
        "rds:AddTagsToResource"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:ResourceTag/CostOptimizer": "protected"
        }
      }
    },
    {
      "Sid": "ScheduledActions",
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:PutTargets",
        "events:DeleteRule",
        "events:RemoveTargets",
        "events:DescribeRule",
        "events:ListRules",
        "scheduler:CreateSchedule",
        "scheduler:UpdateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "scheduler:ListSchedules"
      ],
      "Resource": [
        "arn:aws:events:*:*:rule/cost-optimizer-*",
        "arn:aws:scheduler:*:*:schedule/cost-optimizer/*"
      ]
    },
    {
      "Sid": "S3Lifecycle",
      "Effect": "Allow",
      "Action": [
        "s3:PutLifecycleConfiguration",
        "s3:GetLifecycleConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Notifications",
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:CreateTopic",
        "sns:Subscribe"
      ],
      "Resource": "arn:aws:sns:*:*:cost-optimizer-*"
    },
    {
      "Sid": "PassRoleForSchedules",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::*:role/CostOptimizerScheduleRole",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": [
            "events.amazonaws.com",
            "scheduler.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

### Trust Policy (Both Roles)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::MANAGEMENT_ACCOUNT_ID:role/CostOptimizerAgentRole"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "UNIQUE_EXTERNAL_ID_PER_CUSTOMER"
        }
      }
    }
  ]
}
```

### CloudFormation StackSet Deployment

```bash
# Deploy to entire Organization with one command
aws cloudformation create-stack-set \
  --stack-set-name CostOptimizerRoles \
  --template-url https://s3.amazonaws.com/cost-optimizer-agent/iam-roles.yaml \
  --parameters \
    ParameterKey=AgentAccountId,ParameterValue=123456789012 \
    ParameterKey=ExternalId,ParameterValue=$(uuidgen) \
    ParameterKey=DeployWriteRole,ParameterValue=false \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy write role only to specific accounts (L2/L3)
aws cloudformation create-stack-instances \
  --stack-set-name CostOptimizerWriteRole \
  --accounts 111111111111 222222222222 \
  --regions us-east-1
```

---

## 4. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (cost spike investigation, savings plan modeling, complex analysis)
                 claude-sonnet-4-6 (resource scanning, waste detection, report generation)
                 claude-haiku-4-5 (metric lookups, tag checks, simple queries)
AWS SDK:         @aws-sdk/client-* (v3 modular SDK)
MCP Servers:     3 custom — aws-cost-mcp, aws-resource-mcp, aws-action-mcp
Alerting:        Slack (webhook), Email (SES), PagerDuty (webhook)
Storage:         Local filesystem (reports, audit logs, config)
Config:          JSON files (per-account settings, autonomy levels, protection rules)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install @aws-sdk/client-sts              # Cross-account role assumption
npm install @aws-sdk/client-cost-explorer    # Cost analysis
npm install @aws-sdk/client-ec2              # EC2 resource management
npm install @aws-sdk/client-rds              # RDS management
npm install @aws-sdk/client-s3               # S3 analysis
npm install @aws-sdk/client-cloudwatch       # Metrics
npm install @aws-sdk/client-cloudtrail       # Audit events
npm install @aws-sdk/client-organizations    # Multi-account discovery
npm install @aws-sdk/client-cloudformation   # Stack analysis
npm install @aws-sdk/client-resource-groups-tagging-api  # Tag queries
npm install @aws-sdk/client-eventbridge      # Scheduled actions
npm install @aws-sdk/client-elastic-load-balancing-v2    # ALB/NLB
npm install @aws-sdk/client-elasticache      # ElastiCache
npm install @aws-sdk/client-sns              # Notifications
npm install zod                              # Schema validation
npm install dayjs                            # Date handling
npm install winston                          # Structured logging
npm install p-limit                          # Parallel execution limiter
```

---

## 5. MCP Server Specifications

### 5.1 MCP Server: `aws-cost-mcp` (Cost Intelligence)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `get_cost_breakdown` | Cost by service, account, tag, or region for any date range | `{ group_by: "SERVICE"\|"ACCOUNT"\|"TAG"\|"REGION", start_date, end_date, filter? }` | `{ total, breakdown: [{name, amount, currency, pct}], period }` |
| `get_cost_trend` | Period-over-period cost comparison | `{ granularity: "DAILY"\|"MONTHLY", periods: number, group_by? }` | `{ periods: [{date, amount}], change_pct, trend }` |
| `get_cost_forecast` | Projected spend for current period | `{ period: "MONTH"\|"QUARTER" }` | `{ forecast_amount, confidence_interval, based_on_days }` |
| `detect_cost_anomalies` | Find unexpected cost changes vs baseline | `{ lookback_days?: number, threshold_pct?: number }` | `{ anomalies: [{service, account, expected, actual, delta_pct, date}] }` |
| `get_top_cost_drivers` | Top N resources/services by spend | `{ n: number, period: "LAST_7D"\|"LAST_30D"\|"MTD", account_id? }` | `{ drivers: [{resource_id, service, cost, pct_of_total}] }` |
| `investigate_cost_change` | Deep-dive: correlate cost change with deployments | `{ period_a: DateRange, period_b: DateRange, service? }` | `{ cost_delta, new_resources[], terminated_resources[], usage_changes[], deployment_events[] }` |
| `get_savings_coverage` | Current SP/RI coverage and utilization | `{}` | `{ total_on_demand, covered_by_sp, covered_by_ri, uncovered, utilization_pct }` |
| `model_savings_plan` | Model SP purchase scenarios | `{ commitment_amounts: number[], terms: ("1yr"\|"3yr")[], payment_options: ("all"\|"partial"\|"none")[] }` | `{ scenarios: [{commitment, term, payment, estimated_savings, coverage_pct, risk_level}] }` |
| `get_data_transfer_breakdown` | Breakdown of data transfer costs | `{ account_id?, region? }` | `{ total, nat_gateway, cross_az, internet_egress, s3_egress, cross_region, vpc_peering }` |
| `list_org_accounts` | List all accounts with metadata | `{}` | `{ accounts: [{id, name, email, status, tags, autonomy_level}] }` |
| `get_cost_by_tag` | Cost attribution by tag key/value | `{ tag_key: string, start_date, end_date }` | `{ tagged: [{tag_value, cost}], untagged_cost, tag_coverage_pct }` |

**Implementation — Cost Spike Investigation:**

```typescript
const InvestigateCostChangeSchema = z.object({
  period_a: z.object({ start: z.string(), end: z.string() }).describe("Baseline period"),
  period_b: z.object({ start: z.string(), end: z.string() }).describe("Comparison period"),
  service: z.string().optional().describe("Filter to specific AWS service"),
});

async function investigateCostChange(input: z.infer<typeof InvestigateCostChangeSchema>) {
  // Step 1: Get cost diff by service
  const [costA, costB] = await Promise.all([
    costExplorer.getCostAndUsage({ TimePeriod: input.period_a, GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }] }),
    costExplorer.getCostAndUsage({ TimePeriod: input.period_b, GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }] }),
  ]);

  const costDelta = computeDelta(costA, costB);

  // Step 2: For top changed services, find resource-level changes
  const topChanges = costDelta.filter(d => Math.abs(d.delta_pct) > 10).slice(0, 5);

  // Step 3: Check CloudTrail for new resource creation/deletion
  const deploymentEvents = await Promise.all(
    topChanges.map(change =>
      cloudtrail.lookupEvents({
        StartTime: new Date(input.period_b.start),
        EndTime: new Date(input.period_b.end),
        LookupAttributes: [{
          AttributeKey: "EventName",
          AttributeValue: getCreateEventForService(change.service),
        }],
      })
    )
  );

  // Step 4: Check for usage pattern changes via CloudWatch
  const usageChanges = await detectUsageChanges(topChanges, input.period_a, input.period_b);

  return {
    cost_delta: {
      period_a_total: sumCosts(costA),
      period_b_total: sumCosts(costB),
      absolute_change: sumCosts(costB) - sumCosts(costA),
      pct_change: ((sumCosts(costB) - sumCosts(costA)) / sumCosts(costA)) * 100,
    },
    top_changes: costDelta,
    new_resources: extractNewResources(deploymentEvents),
    terminated_resources: extractTerminatedResources(deploymentEvents),
    usage_changes: usageChanges,
    deployment_events: flattenEvents(deploymentEvents),
  };
}
```

### 5.2 MCP Server: `aws-resource-mcp` (Resource Intelligence)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `find_idle_ec2` | EC2 with low utilization for N days | `{ account_id, regions?: string[], cpu_threshold?: number, days?: number }` | `{ instances: [{id, type, region, avg_cpu, avg_network, running_since, monthly_cost, tags}] }` |
| `find_idle_rds` | RDS with 0 connections for N days | `{ account_id, regions?, days? }` | `{ instances: [{id, engine, class, region, last_connection, monthly_cost, tags}] }` |
| `find_unattached_ebs` | EBS volumes not attached to any instance | `{ account_id, regions? }` | `{ volumes: [{id, size_gb, type, region, last_attached, monthly_cost, tags}] }` |
| `find_stale_snapshots` | Old snapshots with deleted source volumes | `{ account_id, regions?, older_than_days? }` | `{ snapshots: [{id, size_gb, region, created, source_volume, monthly_cost}] }` |
| `find_unused_eips` | Elastic IPs with no association | `{ account_id, regions? }` | `{ eips: [{allocation_id, ip, region, monthly_cost}] }` |
| `find_orphaned_lbs` | Load balancers with 0 healthy targets | `{ account_id, regions?, days? }` | `{ load_balancers: [{arn, type, region, healthy_targets, monthly_cost}] }` |
| `find_zombie_nat_gateways` | NAT Gateways with negligible traffic | `{ account_id, regions?, bytes_threshold? }` | `{ nat_gateways: [{id, region, bytes_processed_30d, monthly_cost}] }` |
| `find_previous_gen_instances` | EC2/RDS on old instance families | `{ account_id, regions? }` | `{ instances: [{id, current_type, recommended_type, savings_pct, monthly_savings}] }` |
| `find_region_sprawl` | Resources in unexpected regions | `{ account_id, expected_regions: string[] }` | `{ unexpected: [{region, resource_count, monthly_cost, resources[]}] }` |
| `get_instance_utilization` | Detailed metrics for a specific instance | `{ instance_id, region, days?: number }` | `{ cpu: Stats, memory?: Stats, network: Stats, disk?: Stats, connections?: number }` |
| `get_rightsizing_recommendation` | Recommend optimal instance type | `{ instance_id, region }` | `{ current_type, recommended_type, current_cost, recommended_cost, savings, confidence, metrics_summary }` |
| `discover_resource_dependencies` | What depends on this resource | `{ resource_id, region }` | `{ security_groups[], load_balancers[], auto_scaling_groups[], eni_attachments[], dns_records? }` |
| `map_resource_ownership` | Infer owner from tags, stacks, CloudTrail | `{ resource_id, region }` | `{ tags, cloudformation_stack?, creator_arn?, creator_time?, vpc_name?, inferred_team? }` |
| `get_s3_usage_analysis` | Bucket sizes, access patterns, lifecycle | `{ account_id }` | `{ buckets: [{name, size_gb, storage_classes, last_accessed, has_lifecycle, monthly_cost}] }` |
| `find_untagged_resources` | Resources missing required tags | `{ account_id, regions?, required_tags: string[] }` | `{ untagged: [{resource_arn, resource_type, region, missing_tags[]}], coverage_pct }` |
| `scan_all_waste` | Comprehensive waste scan (all find_* combined) | `{ account_id?, regions? }` | `{ waste_items: WasteItem[], total_monthly_savings, by_category: {} }` |

**Implementation — Comprehensive Waste Scan:**

```typescript
async function scanAllWaste(input: { account_id?: string; regions?: string[] }) {
  const accounts = input.account_id
    ? [input.account_id]
    : await listAllAccountIds();

  const allWaste: WasteItem[] = [];

  // Run all waste detection tools in parallel per account
  for (const accountId of accounts) {
    const regions = input.regions || await getEnabledRegions(accountId);

    const [idle_ec2, idle_rds, unattached_ebs, stale_snaps, unused_eips,
           orphaned_lbs, zombie_nats, old_gen] = await Promise.all([
      findIdleEc2({ account_id: accountId, regions }),
      findIdleRds({ account_id: accountId, regions }),
      findUnattachedEbs({ account_id: accountId, regions }),
      findStaleSnapshots({ account_id: accountId, regions }),
      findUnusedEips({ account_id: accountId, regions }),
      findOrphanedLbs({ account_id: accountId, regions }),
      findZombieNatGateways({ account_id: accountId, regions }),
      findPreviousGenInstances({ account_id: accountId, regions }),
    ]);

    allWaste.push(
      ...idle_ec2.instances.map(i => ({ type: "idle_ec2", ...i, account: accountId })),
      ...idle_rds.instances.map(i => ({ type: "idle_rds", ...i, account: accountId })),
      ...unattached_ebs.volumes.map(v => ({ type: "unattached_ebs", ...v, account: accountId })),
      ...stale_snaps.snapshots.map(s => ({ type: "stale_snapshot", ...s, account: accountId })),
      ...unused_eips.eips.map(e => ({ type: "unused_eip", ...e, account: accountId })),
      ...orphaned_lbs.load_balancers.map(l => ({ type: "orphaned_lb", ...l, account: accountId })),
      ...zombie_nats.nat_gateways.map(n => ({ type: "zombie_nat", ...n, account: accountId })),
      ...old_gen.instances.map(i => ({ type: "previous_gen", ...i, account: accountId })),
    );
  }

  // Sort by monthly savings (highest first)
  allWaste.sort((a, b) => b.monthly_cost - a.monthly_cost);

  return {
    waste_items: allWaste,
    total_monthly_savings: allWaste.reduce((sum, w) => sum + w.monthly_cost, 0),
    by_category: groupBy(allWaste, "type"),
    by_account: groupBy(allWaste, "account"),
    by_region: groupBy(allWaste, "region"),
  };
}
```

### 5.3 MCP Server: `aws-action-mcp` (Execution with Safety)

| Tool | Safety | Description | Pre-conditions |
|------|--------|-------------|---------------|
| `stop_instances` | 🟢 Safe | Stop EC2 instances | Not tagged `protected` |
| `start_instances` | 🟢 Safe | Start EC2 instances | — |
| `resize_instance` | 🟡 Risky | Stop → snapshot → modify type → start → health check → rollback if unhealthy | Human approval for prod, snapshot created, maintenance window |
| `terminate_instances` | 🔴 Irreversible | Terminate EC2 instances | Always human approval, must be tagged `approved-for-termination` |
| `delete_ebs_volumes` | 🟡 Risky | Snapshot then delete unattached volumes | Volume must be `available` state, snapshot created first |
| `delete_snapshots` | 🟡 Risky | Delete stale/orphaned snapshots | Source volume must not exist, older than threshold |
| `release_elastic_ips` | 🟢 Safe | Release unassociated EIPs | Must not be associated |
| `resize_rds_instance` | 🟡 Risky | Modify RDS instance class | Human approval for prod, apply during maintenance window |
| `stop_rds_instance` | 🟡 Risky | Stop RDS (auto-restarts after 7 days) | Not production tagged |
| `start_rds_instance` | 🟢 Safe | Start a stopped RDS | — |
| `create_vpc_endpoint` | 🟢 Safe | Create VPC endpoint (additive, no disruption) | VPC ID, service name, route table IDs |
| `create_schedule` | 🟢 Safe | Create EventBridge start/stop schedule | Schedule name prefixed `cost-optimizer-` |
| `update_schedule` | 🟢 Safe | Modify existing schedule | Must be cost-optimizer-* prefixed |
| `delete_schedule` | 🟢 Safe | Remove scheduled action | Must be cost-optimizer-* prefixed |
| `apply_s3_lifecycle` | 🟡 Risky | Set lifecycle policy for storage tiering | Human approval, no existing conflicting policy |
| `tag_resources` | 🟢 Safe | Apply/update tags | — |
| `create_pre_action_snapshot` | 🟢 Safe | Safety snapshot before any risky action | Automatically called by risky actions |
| `rollback_action` | 🟢 Safe | Reverse last action using snapshot/prior state | Snapshot must exist |
| `verify_health_post_action` | 🟢 Safe | Check instance/service health after a change | Runs health checks for N minutes |

**Implementation — Safe Resize with Rollback:**

```typescript
const ResizeInstanceSchema = z.object({
  instance_id: z.string(),
  region: z.string(),
  new_instance_type: z.string(),
  maintenance_window: z.string().optional().describe("Cron expression or 'now'"),
  health_check_minutes: z.number().default(15),
});

async function resizeInstance(input: z.infer<typeof ResizeInstanceSchema>, context: AgentContext) {
  const ec2 = getEc2Client(input.region);

  // Step 1: Check if resource is protected
  const tags = await getInstanceTags(input.instance_id, input.region);
  if (tags["CostOptimizer"] === "protected") {
    return { status: "blocked", reason: "Instance is tagged as protected" };
  }

  // Step 2: Check autonomy level
  const accountId = await getAccountForInstance(input.instance_id, input.region);
  const autonomy = await getAutonomyLevel(accountId);
  const isProduction = tags["Environment"] === "production";

  if (isProduction || autonomy < 3) {
    // Requires human approval — return proposal
    return {
      status: "awaiting_approval",
      action: "resize_instance",
      instance_id: input.instance_id,
      current_type: await getCurrentInstanceType(input.instance_id, input.region),
      new_type: input.new_instance_type,
      is_production: isProduction,
      message: `Resize ${input.instance_id} from ${await getCurrentInstanceType(input.instance_id, input.region)} to ${input.new_instance_type}. This is a ${isProduction ? "PRODUCTION" : "non-production"} instance. Approve?`,
    };
  }

  // Step 3: Wait for maintenance window if specified
  if (input.maintenance_window && input.maintenance_window !== "now") {
    return scheduleResize(input);
  }

  // Step 4: Create safety snapshot
  const originalType = await getCurrentInstanceType(input.instance_id, input.region);
  const snapshotId = await createPreActionSnapshot(input.instance_id, input.region);

  // Step 5: Stop instance
  await ec2.stopInstances({ InstanceIds: [input.instance_id] });
  await waitForInstanceState(input.instance_id, input.region, "stopped");

  // Step 6: Modify instance type
  await ec2.modifyInstanceAttribute({
    InstanceId: input.instance_id,
    InstanceType: { Value: input.new_instance_type },
  });

  // Step 7: Start instance
  await ec2.startInstances({ InstanceIds: [input.instance_id] });
  await waitForInstanceState(input.instance_id, input.region, "running");

  // Step 8: Health check monitoring
  const healthResult = await monitorHealth(input.instance_id, input.region, input.health_check_minutes);

  if (!healthResult.healthy) {
    // Step 9: AUTO-ROLLBACK
    await ec2.stopInstances({ InstanceIds: [input.instance_id] });
    await waitForInstanceState(input.instance_id, input.region, "stopped");
    await ec2.modifyInstanceAttribute({
      InstanceId: input.instance_id,
      InstanceType: { Value: originalType },
    });
    await ec2.startInstances({ InstanceIds: [input.instance_id] });

    await logAction({
      action: "resize_rollback",
      instance_id: input.instance_id,
      reason: `Health check failed after resize to ${input.new_instance_type}. Rolled back to ${originalType}.`,
      snapshot_id: snapshotId,
    });

    return {
      status: "rolled_back",
      reason: healthResult.failure_reason,
      original_type: originalType,
      attempted_type: input.new_instance_type,
    };
  }

  // Step 10: Success — log and report
  await logAction({
    action: "resize_success",
    instance_id: input.instance_id,
    from_type: originalType,
    to_type: input.new_instance_type,
    snapshot_id: snapshotId,
    health_check: "passed",
  });

  return {
    status: "resized",
    instance_id: input.instance_id,
    from_type: originalType,
    to_type: input.new_instance_type,
    health_check: "passed",
    safety_snapshot: snapshotId,
    estimated_monthly_savings: await calculateSavings(originalType, input.new_instance_type, input.region),
  };
}
```

---

## 6. Core Workflows — Detailed

### 6.1 Workflow: Cost Spike Investigation

The agent's signature capability — multi-step investigation:

```
Agent investigation chain:

1. get_cost_trend(granularity="DAILY", periods=60)
   → Identify the exact date range where the spike started

2. get_cost_breakdown(group_by="SERVICE", start=spike_start, end=spike_end)
   → "EC2 +₹3.2L, Data Transfer +₹1.8L, NAT Gateway +₹95K"

3. get_cost_breakdown(group_by="ACCOUNT", service_filter="EC2")
   → "Dev account (111111111111) +₹2.4L"

4. investigate_cost_change(period_a=baseline, period_b=spike_period, service="EC2")
   → "8 new r6i.4xlarge instances launched Mar 12 via CloudFormation stack 'load-test-march'"

5. find_idle_ec2(account_id="111111111111")
   → "All 8 instances at 0.3% CPU since Mar 15"

6. get_data_transfer_breakdown(account_id="111111111111", region="us-east-1")
   → "NAT Gateway processing 6TB/day — ECS pulling ECR images via NAT"

7. Present findings with actionable remediation
```

### 6.2 Workflow: Waste Detection & Cleanup

```
Agent orchestration for scan_all_waste:

1. list_org_accounts()
   → Get all accounts + autonomy levels

2. For each account (parallel):
   scan_all_waste(account_id=X)
   → Runs 8 waste detection tools concurrently per account

3. Aggregate, deduplicate, rank by savings

4. Present prioritized waste report:
   ┌────┬──────────────┬──────────┬────────────┬───────────┬───────────┐
   │ #  │ Type         │ Resource │ Account    │ Region    │ Savings/mo│
   ├────┼──────────────┼──────────┼────────────┼───────────┼───────────┤
   │ 1  │ Idle EC2     │ i-0abc   │ Dev        │ us-east-1 │ ₹24,500  │
   │ 2  │ Idle RDS     │ db-xyz   │ Staging    │ ap-south  │ ₹18,200  │
   │ 3  │ Unattach EBS │ vol-def  │ Dev        │ us-east-1 │ ₹8,400   │
   │ 4  │ Zombie NAT   │ nat-ghi  │ Shared     │ eu-west-1 │ ₹7,800   │
   │ ...│              │          │            │           │           │
   └────┴──────────────┴──────────┴────────────┴───────────┴───────────┘
   Total: ₹1,42,000/month savings available

5. Based on autonomy levels:
   - L2/L3 accounts: auto-execute safe cleanups
   - L1 accounts: present as recommendations
   - Production resources: always ask for approval
```

### 6.3 Workflow: Rightsizing Execution

```
For each idle/oversized instance:

1. get_instance_utilization(instance_id, region, days=30)
   → CPU avg 12%, p99 34%; Memory avg 28%, p99 52%

2. discover_resource_dependencies(instance_id, region)
   → Part of ASG? Behind ALB? ENI attachments?

3. get_rightsizing_recommendation(instance_id, region)
   → "m5.2xlarge → m7g.xlarge: 42% savings, Graviton bonus"

4. map_resource_ownership(instance_id, region)
   → "CFN stack: api-server, Team: platform, Creator: deploy-role"

5. If approved:
   resize_instance(instance_id, region, new_type, health_check_minutes=15)
   → Stop → snapshot → resize → start → monitor → rollback if unhealthy

6. Post-resize: monitor for 24 hours, report before/after metrics
```

### 6.4 Workflow: Scheduled Scaling

```
Agent detects dev/staging patterns:

1. find_idle_ec2 across dev/staging accounts
   → 24 instances, 6 RDS — used Mon-Fri 9am-8pm IST

2. Analyze CloudWatch metrics for usage patterns:
   → CPU/connections near-zero outside business hours
   → CPU/connections active 9am-8pm weekdays

3. Propose schedules:
   create_schedule("cost-optimizer-dev-stop", "cron(0 21 ? * MON-FRI *)")
   create_schedule("cost-optimizer-dev-start", "cron(30 8 ? * MON-FRI *)")
   create_schedule("cost-optimizer-dev-weekend-stop", "cron(0 21 ? * FRI *)")
   create_schedule("cost-optimizer-dev-weekend-start", "cron(30 8 ? * MON *)")

4. Exclude always-on instances (CI/CD, shared services)

5. Estimated savings: ₹2.7L/month (56% of dev spend)
```

### 6.5 Workflow: Data Transfer Cost Analysis

```
1. get_data_transfer_breakdown(account_id, region)
   → NAT: 18TB, Cross-AZ: 12TB, Internet: 10TB, S3: 5TB

2. For NAT Gateway costs:
   → Identify which services are routing through NAT
   → Check if VPC endpoints exist for ECR, S3, DynamoDB, SQS
   → If missing: propose create_vpc_endpoint for each

3. For Cross-AZ costs:
   → Identify which EC2/ECS tasks communicate cross-AZ
   → Check if single-AZ deployment is feasible for non-HA workloads

4. Present actionable plan with before/after cost estimates
```

### 6.6 Workflow: Savings Plan Optimization

```
1. get_savings_coverage()
   → On-demand: ₹12.4L/mo, Covered: 26%, Uncovered: ₹9.2L/mo

2. Analyze 90-day compute usage patterns:
   → Baseline compute usage (consistent floor)
   → Variable compute (scaling, batch jobs)
   → Identify commitment-safe floor

3. model_savings_plan with multiple scenarios:
   → Conservative (1yr, no-upfront): cover 60%, save 14.5%
   → Balanced (1yr, partial): cover 76%, save 25%
   → Aggressive (3yr, all-upfront): cover 90%, save 39%

4. ⚠️ NEVER auto-purchase — always present for human decision
   → Include risk analysis for each option
   → Show what happens if usage drops 20%/40%
```

---

## 7. File Structure

```
cost-optimizer/
├── config/
│   ├── agent-config.json              # Agent identity, defaults
│   ├── accounts/
│   │   ├── 111111111111.json          # Per-account: autonomy level, protected resources, schedules
│   │   ├── 222222222222.json
│   │   └── ...
│   ├── protection-rules.json          # Global protection rules (never touch these tags/accounts)
│   ├── notification-channels.json     # Slack webhooks, email addresses, PagerDuty
│   └── maintenance-windows.json       # Per-account maintenance windows for prod changes
├── reports/
│   ├── cost-health/
│   │   ├── 2026-03-24_initial-assessment.md
│   │   └── 2026-03-31_weekly-report.md
│   ├── waste-scans/
│   │   ├── 2026-03-24_full-scan.json
│   │   └── ...
│   ├── investigations/
│   │   ├── 2026-03-24_cost-spike-march.md
│   │   └── ...
│   └── savings-plan-analysis/
│       └── 2026-03-24_sp-modeling.md
├── audit/
│   ├── action-log.jsonl               # Every action executed (append-only)
│   ├── approval-log.jsonl             # Human approvals/denials
│   ├── rollback-log.jsonl             # All rollbacks
│   └── investigation-log.jsonl        # Investigation chains and findings
├── schedules/
│   └── active-schedules.json          # Currently active EventBridge schedules
└── cache/
    ├── resource-inventory/            # Cached resource inventory (refreshed daily)
    │   ├── 111111111111.json
    │   └── ...
    └── cost-data/                     # Cached cost queries (15 min TTL)
        └── ...
```

### agent-config.json

```json
{
  "organization_id": "o-abc123def4",
  "management_account_id": "000000000000",
  "agent_role_arn": "arn:aws:iam::000000000000:role/CostOptimizerAgentRole",
  "external_id": "unique-per-customer-uuid",
  "default_autonomy_level": 1,
  "default_regions": ["us-east-1", "ap-south-1"],
  "currency": "INR",
  "usd_to_inr_rate": 85,
  "scan_schedule": "daily_0600_ist",
  "report_schedule": "weekly_monday_0900_ist",
  "notification_channels": {
    "slack_webhook": "https://hooks.slack.com/services/...",
    "email": ["devops@company.com"],
    "pagerduty_integration_key": "..."
  },
  "global_protection_tags": [
    { "key": "CostOptimizer", "value": "protected" },
    { "key": "Environment", "value": "compliance" }
  ],
  "never_terminate_without_approval": true,
  "snapshot_before_risky_actions": true,
  "health_check_minutes_after_resize": 15,
  "idle_threshold_cpu_pct": 5,
  "idle_threshold_days": 14,
  "stale_snapshot_days": 90
}
```

### Per-Account Config (accounts/111111111111.json)

```json
{
  "account_id": "111111111111",
  "account_name": "Development",
  "autonomy_level": 2,
  "primary_regions": ["us-east-1", "ap-south-1"],
  "environment": "development",
  "team_owner": "Platform Engineering",
  "notification_override": {
    "slack_channel": "#dev-cost-alerts"
  },
  "protected_resources": [
    "i-0ci-cd-runner-01",
    "db-shared-dev-postgres"
  ],
  "scheduled_scaling": {
    "enabled": true,
    "stop_time": "21:00 IST",
    "start_time": "08:30 IST",
    "active_days": ["MON", "TUE", "WED", "THU", "FRI"],
    "exclude_instances": ["i-0ci-cd-runner-01"]
  },
  "maintenance_window": null
}
```

---

## 8. Error Handling & Safety

### Action Safety Matrix

| Action | Reversible? | Safety Net | Auto-Execute at L2 | Auto-Execute at L3 |
|--------|------------|------------|--------------------|--------------------|
| Stop EC2 (non-prod) | ✅ Start it | None needed | ✅ | ✅ |
| Stop EC2 (prod) | ✅ Start it | None needed | ❌ Approval | ❌ Approval |
| Resize EC2 | ✅ Resize back | Snapshot | ❌ Approval | ✅ (with rollback) |
| Terminate EC2 | ❌ Gone | Final snapshot | ❌ Always approval | ❌ Always approval |
| Delete EBS (unattached) | ❌ Gone | Snapshot first | ✅ (snapshot+delete) | ✅ |
| Delete snapshot | ❌ Gone | Check not last | ❌ Approval | ✅ (if stale) |
| Release EIP | ⚠️ IP lost | Log IP address | ✅ | ✅ |
| Resize RDS | ✅ Resize back | DB snapshot | ❌ Approval | ✅ (non-prod) |
| Stop RDS | ⚠️ Auto-starts 7d | None needed | ✅ (non-prod) | ✅ |
| Create VPC endpoint | ✅ Delete it | None needed | ✅ | ✅ |
| Create schedule | ✅ Delete it | None needed | ✅ | ✅ |
| S3 lifecycle | ⚠️ Data moves | Log existing policy | ❌ Approval | ✅ |
| Tag resources | ✅ Remove tag | Log previous | ✅ | ✅ |

### Error Scenarios

| Scenario | Detection | Strategy |
|----------|-----------|----------|
| **AssumeRole failure** | STS error / access denied | Skip account, alert operator, continue with remaining accounts |
| **Region not enabled** | EC2 DescribeRegions shows opt-in-not-required=false | Skip region, note in report |
| **Rate limiting** | Throttling exception from AWS SDK | Exponential backoff (1s, 2s, 4s, 8s), retry up to 5 times |
| **Resize fails** | Instance stuck in stopping/pending | Wait with timeout (10 min), then rollback |
| **Health check fails post-resize** | Application health endpoint returns unhealthy | Auto-rollback to original instance type, alert operator |
| **Instance in ASG** | Resize would conflict with ASG launch template | Block resize, recommend launch template update instead |
| **Spot instance detected** | Cannot resize spot instances | Skip, note in recommendations |
| **Resource already modified** | State changed between scan and action | Re-scan resource state before executing, abort if unexpected |
| **CloudTrail not enabled** | No events returned for investigation | Warn: "Investigation limited — CloudTrail not enabled in account X" |
| **Cost data delay** | Cost Explorer data lags 24-48 hours | Note data freshness in all cost reports |
| **Protected resource tag** | Resource tagged `protected` or `compliance-locked` | Skip all actions, include in report as "protected — manual review" |

### Rollback Protocol

Every risky action follows this protocol:

```
1. PRE-ACTION
   ├── Check protection tags → abort if protected
   ├── Check autonomy level → request approval if needed
   ├── Check dependencies → warn if downstream impact
   ├── Create safety snapshot (EC2: AMI, RDS: DB snapshot, EBS: snapshot)
   └── Log: action_planned, before_state, snapshot_id

2. EXECUTE
   ├── Perform the action (stop, resize, delete, etc.)
   └── Log: action_executed, timestamp

3. VERIFY (for resize/modify actions)
   ├── Wait for resource to reach desired state
   ├── Run health checks for N minutes
   │   ├── EC2: instance status checks + system status checks
   │   ├── RDS: connection test
   │   └── Custom: HTTP health endpoint if configured
   └── Log: verification_result

4. POST-ACTION
   ├── If healthy: log success, report savings
   ├── If unhealthy: ROLLBACK
   │   ├── Revert to original configuration using snapshot
   │   ├── Verify rollback succeeded
   │   ├── Alert operator with failure details
   │   └── Log: rollback_executed, reason
   └── If rollback fails: ALERT CRITICAL — manual intervention needed
```

---

## 9. Security Considerations

### Principle of Least Privilege

| Principle | Implementation |
|-----------|---------------|
| **Separate read/write roles** | Read role deployed everywhere, write role only where L2/L3 is enabled |
| **Condition-based restrictions** | Write role cannot touch `protected`-tagged resources via IAM conditions |
| **Scoped resource names** | EventBridge rules and SNS topics prefixed `cost-optimizer-*` — cannot interfere with existing infra |
| **External ID for cross-account** | Every AssumeRole requires customer-specific external ID — prevents confused deputy |
| **No IAM modification** | Agent has zero IAM write permissions — cannot escalate its own privileges |
| **No security group access** | Agent cannot modify security groups, NACLs, or network configuration (except VPC endpoints) |
| **Terminate requires tag** | EC2 termination only works on instances tagged `approved-for-termination` — defense in depth |

### Audit Trail

Every action is logged to append-only JSONL files:

```json
{
  "timestamp": "2026-03-24T14:30:00+05:30",
  "action_id": "act_00142",
  "action": "resize_instance",
  "account_id": "111111111111",
  "region": "us-east-1",
  "resource_id": "i-0abc123def456",
  "before_state": { "instance_type": "m5.2xlarge" },
  "after_state": { "instance_type": "m7g.xlarge" },
  "safety_snapshot": "snap-0123456789abcdef0",
  "autonomy_level": 3,
  "human_approval": null,
  "health_check": "passed",
  "rollback": false,
  "estimated_savings_monthly_inr": 18400,
  "initiated_by": "agent",
  "approved_by": "auto (L3, non-production)"
}
```

### Multi-Customer Isolation

For managed services providers (ScaleCapacity) managing multiple customers:

| Concern | Implementation |
|---------|---------------|
| **Credential isolation** | Separate IAM role + external ID per customer. No cross-customer credential sharing. |
| **Data isolation** | Separate config directory and audit logs per customer. Agent context is per-customer. |
| **Cost data privacy** | One customer's cost data never included in another customer's reports. |
| **Action isolation** | Agent operates on one customer at a time. No batch operations across customers. |

---

## 10. Example User Interactions

### Example 1: Cost Spike Investigation

```
User: "Our AWS bill jumped 40% this month. What happened?"

Agent: Let me investigate. Pulling cost data...

  📊 March 2026 vs February 2026:
  Total: ₹17.8L → ₹24.9L (+₹7.1L, +40%)

  Top changes by service:
  ┌─────────────────────┬──────────┬──────────┬───────────┐
  │ Service             │ Feb      │ Mar      │ Change    │
  ├─────────────────────┼──────────┼──────────┼───────────┤
  │ EC2-Instances       │ ₹8.2L   │ ₹11.4L  │ +₹3.2L   │
  │ Data Transfer       │ ₹2.8L   │ ₹4.6L   │ +₹1.8L   │
  │ NAT Gateway         │ ₹1.1L   │ ₹2.1L   │ +₹95K    │
  │ RDS                 │ ₹3.4L   │ ₹3.8L   │ +₹40K    │
  │ S3                  │ ₹1.2L   │ ₹1.5L   │ +₹30K    │
  └─────────────────────┴──────────┴──────────┴───────────┘

  Investigating root causes...

  🔍 Root Cause #1: Forgotten load-test instances (₹2.4L/month)
  ─────────────────────────────────────────────────
  Account: Dev (111111111111)
  What: 8× r6i.4xlarge instances launched Mar 12 at 14:32 IST
  Who: CI/CD role via CloudFormation stack "load-test-march"
  Current state: All 8 running at 0.3% CPU, 0.1% network since Mar 15
  Root cause: Load test completed Mar 15, stack never torn down

  → Action: Terminate all 8 instances? (saves ₹2.4L/month) [approve/deny]

  🔍 Root Cause #2: NAT Gateway data transfer (₹1.8L/month avoidable)
  ─────────────────────────────────────────────────
  Account: Production (222222222222), Region: us-east-1
  What: NAT Gateway processing 6TB/day — up from 2TB in Feb
  Why: New ECS service "recommendation-engine" (deployed Mar 8) pulls
       ML models from S3 and writes to DynamoDB — all routed through
       NAT Gateway because no VPC endpoints exist
  Fix: Create VPC endpoints for S3 and DynamoDB in production VPC

  → Action: Create S3 + DynamoDB VPC endpoints? (saves ~₹1.6L/month) [approve/deny]

  🔍 Root Cause #3: RDS instance upgrade (₹40K/month)
  ─────────────────────────────────────────────────
  Account: Production (222222222222)
  What: db-analytics upgraded from db.r6g.xlarge to db.r6g.4xlarge on Mar 5
  Who: DBA team (user: dba-admin)
  Note: This appears intentional — CPU was at 85% before upgrade. No action needed.

  📋 Summary:
  ┌──────────────┬───────────┬─────────────────────────┐
  │ Root Cause   │ Impact    │ Status                  │
  ├──────────────┼───────────┼─────────────────────────┤
  │ Load test    │ ₹2.4L/mo │ ⏳ Awaiting approval     │
  │ NAT Gateway  │ ₹1.6L/mo │ ⏳ Awaiting approval     │
  │ RDS upgrade  │ ₹40K/mo  │ ✅ Intentional, no action│
  └──────────────┴───────────┴─────────────────────────┘
  Addressable savings: ₹4.0L/month (56% of the spike)
```

### Example 2: Weekly Waste Cleanup

```
Agent (automated weekly scan, L2 accounts):

  📊 Weekly Waste Scan — March 24, 2026

  Scanned: 8 accounts, 3 regions, 847 resources

  🗑️ Waste Found: ₹1,42,000/month total
  ┌────┬──────────────┬────────────────┬──────────┬──────────┬───────────┐
  │ #  │ Type         │ Resource       │ Account  │ Region   │ Savings/mo│
  ├────┼──────────────┼────────────────┼──────────┼──────────┼───────────┤
  │ 1  │ Idle EC2     │ i-0abc (m5.xl) │ Dev      │ us-east-1│ ₹24,500  │
  │ 2  │ Idle RDS     │ db-test-pg     │ Staging  │ ap-south │ ₹18,200  │
  │ 3  │ Unattach EBS │ 12 volumes     │ Dev (×3) │ Mixed    │ ₹14,800  │
  │ 4  │ Zombie NAT   │ nat-0ghi       │ Shared   │ eu-west-1│ ₹7,800   │
  │ 5  │ Stale snaps  │ 34 snapshots   │ Mixed    │ Mixed    │ ₹6,200   │
  │ 6  │ Unused EIPs  │ 8 addresses    │ Mixed    │ Mixed    │ ₹2,800   │
  │ 7  │ Old gen EC2  │ 3× m4.large    │ Staging  │ us-east-1│ ₹4,200   │
  │ 8  │ Orphaned ALB │ alb-old-api    │ Dev      │ us-east-1│ ₹3,500   │
  └────┴──────────────┴────────────────┴──────────┴──────────┴───────────┘

  ✅ Auto-executed (L2 safe actions):
  - Released 8 unused Elastic IPs → ₹2,800/mo saved
  - Snapshotted + deleted 12 unattached EBS volumes → ₹14,800/mo saved
  - Stopped idle EC2 i-0abc in Dev → ₹24,500/mo saved
  - Deleted 34 stale snapshots (source volumes gone, >90 days old) → ₹6,200/mo saved

  ⏳ Needs your approval:
  - Stop idle RDS db-test-pg in Staging (₹18,200/mo)
  - Delete zombie NAT nat-0ghi in eu-west-1 + update route tables (₹7,800/mo)
  - Upgrade 3× m4.large → m7g.medium in Staging (₹4,200/mo savings)
  - Decommission orphaned ALB alb-old-api in Dev (₹3,500/mo)

  💰 Total auto-saved this week: ₹48,300/month
  💰 Pending approval: ₹33,700/month additional
```

### Example 3: Scheduled Scaling Setup

```
User: "Set up stop/start schedules for our dev environments."

Agent: Let me analyze dev account usage patterns first...

  📊 Dev Account (111111111111) — 30-day usage analysis:

  24 EC2 instances + 6 RDS instances
  Active hours: Mon-Fri, 9:00 AM - 8:30 PM IST (based on CPU/connection metrics)
  Weekend activity: Near zero (< 1% CPU, 0 DB connections)

  Current 24/7 monthly cost: ₹4,82,000

  💡 Proposed schedules:

  Weekday Stop:  Mon-Fri at 9:00 PM IST (21:00)
  Weekday Start: Mon-Fri at 8:30 AM IST (08:30)
  Weekend Stop:  Friday at 9:00 PM IST
  Weekend Start: Monday at 8:30 AM IST

  Excluded (always-on):
  - i-0ci-cd-runner-01 (Jenkins CI/CD — runs nightly builds)
  - db-shared-dev-postgres (shared dev database — other teams may access off-hours)

  Covered: 22 EC2 + 5 RDS instances
  Weekly uptime: 57.5 hrs → vs 168 hrs (current)

  Estimated savings: ₹2,72,000/month (56%)

  Create these schedules? [approve / customize / deny]

User: "Approve, but also keep the staging API server running."

Agent: Got it — excluding i-staging-api-01 as well.

  ✅ Created 4 EventBridge schedules:
  - cost-optimizer-dev-weekday-stop (Mon-Fri 21:00 IST)
  - cost-optimizer-dev-weekday-start (Mon-Fri 08:30 IST)
  - cost-optimizer-dev-weekend-stop (Fri 21:00 IST)
  - cost-optimizer-dev-weekend-start (Mon 08:30 IST)

  Covering: 21 EC2 + 5 RDS (excluded: CI/CD runner, shared DB, staging API)
  Revised savings estimate: ₹2,58,000/month

  Schedules active. I'll monitor for the first week and report any issues.
```

### Example 4: Data Transfer Optimization

```
User: "Our data transfer costs seem high. Investigate."

Agent: Analyzing data transfer across your Organization...

  📊 Monthly Data Transfer: ₹4.8L across 3 accounts

  ┌────────────────────────────┬────────┬──────────┬───────────────────┐
  │ Transfer Type              │ Volume │ Cost     │ Optimization      │
  ├────────────────────────────┼────────┼──────────┼───────────────────┤
  │ NAT Gateway processing     │ 22 TB  │ ₹1,87K  │ 🔴 VPC endpoints  │
  │ Internet egress            │ 12 TB  │ ₹91,800 │ ⚪ CloudFront?     │
  │ Cross-AZ (EC2↔EC2)        │ 15 TB  │ ₹12,750 │ 🟡 AZ placement   │
  │ Cross-AZ (ECS↔RDS)        │ 8 TB   │ ₹6,800  │ 🟡 Same-AZ config │
  │ Cross-region replication   │ 4 TB   │ ₹6,800  │ ⚪ Expected        │
  │ S3 → Internet             │ 6 TB   │ ₹45,900 │ ⚪ CloudFront?     │
  └────────────────────────────┴────────┴──────────┴───────────────────┘

  🔴 Biggest win: NAT Gateway (₹1.87L/month)

  NAT Gateway in us-east-1 (Production):
  Top consumers:
  - ECS "recommendation-engine" → S3: 8TB/month
  - ECS "data-pipeline" → DynamoDB: 6TB/month
  - ECS "api-service" → SQS + SNS: 4TB/month
  - Lambda functions → Secrets Manager: 2TB/month
  - Various → ECR image pulls: 2TB/month

  Fix: Create VPC endpoints for these services:
  ┌──────────────┬────────────┬──────────────┐
  │ Service      │ Type       │ Monthly Cost │
  ├──────────────┼────────────┼──────────────┤
  │ S3           │ Gateway    │ Free         │
  │ DynamoDB     │ Gateway    │ Free         │
  │ ECR (api+dkr)│ Interface  │ ₹1,500      │
  │ SQS          │ Interface  │ ₹750        │
  │ SNS          │ Interface  │ ₹750        │
  │ Secrets Mgr  │ Interface  │ ₹750        │
  └──────────────┴────────────┴──────────────┘
  Total endpoint cost: ₹3,750/month
  NAT savings: ₹1,72,000/month
  Net savings: ₹1,68,250/month (90% reduction in NAT costs)

  → Create all 6 VPC endpoints? [approve / select specific / deny]
```

### Example 5: Savings Plan Analysis

```
User: "We should probably buy Savings Plans. What do you recommend?"

Agent: Let me analyze your compute usage patterns...

  📊 90-day Compute Analysis (all accounts):

  On-demand compute spend: ₹12.4L/month (average)
  Existing Savings Plans: ₹3.2L/month commitment (covers 26%)
  Uncovered on-demand: ₹9.2L/month

  Usage stability analysis:
  - Stable floor (never drops below): ₹7.8L/month
  - Variable range: ₹7.8L - ₹14.2L/month
  - Weekday average: ₹13.1L/month
  - Weekend average: ₹8.4L/month

  💡 Recommendations:

  ┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
  │ Option       │ Commit   │ Term     │ Payment  │ Savings  │ Risk     │
  ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │ Conservative │ ₹4.5L/mo│ 1 year   │No upfront│ ₹1.8L/mo│ Very low │
  │              │          │          │          │ (14.5%)  │          │
  ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │ Balanced ⭐  │ ₹6.2L/mo│ 1 year   │ Partial  │ ₹3.1L/mo│ Low      │
  │              │          │          │ upfront  │ (25%)    │          │
  ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │ Aggressive   │ ₹8.0L/mo│ 3 year   │All upfrt │ ₹4.8L/mo│ Medium   │
  │              │          │          │(₹2.88Cr) │ (39%)    │          │
  └──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

  ⭐ I recommend the Balanced option because:
  - ₹6.2L commitment is 80% of your stable floor (₹7.8L) — very safe
  - 1-year term limits lock-in risk
  - Partial upfront gives better rate than no-upfront
  - Even if usage drops 20%, you'd still utilize 97% of the commitment
  - Annual savings: ₹37.2L

  Stress test:
  ┌──────────────────────┬──────────────┬──────────┐
  │ Scenario             │ Utilization  │ Net Save │
  ├──────────────────────┼──────────────┼──────────┤
  │ Usage stays same     │ 100%         │ ₹37.2L/yr│
  │ Usage drops 10%      │ 100%         │ ₹33.5L/yr│
  │ Usage drops 20%      │ 97%          │ ₹29.1L/yr│
  │ Usage drops 40%      │ 82%          │ ₹17.4L/yr│
  │ Usage drops 50%      │ 73%          │ ₹8.2L/yr │
  └──────────────────────┴──────────────┴──────────┘

  ⚠️ I cannot purchase Savings Plans automatically.
  This is a financial commitment that requires your decision.
  Would you like me to generate a formal proposal document for your finance team?
```

---

## 11. Data Model

### Core Types

```typescript
// Organization structure
interface OrgAccount {
  account_id: string;
  account_name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  joined_at: string;
  tags: Record<string, string>;
  autonomy_level: 1 | 2 | 3;
  environment: "production" | "staging" | "development" | "shared" | "sandbox";
  primary_regions: string[];
  write_role_deployed: boolean;
}

// Waste detection result
interface WasteItem {
  type: WasteType;
  resource_id: string;
  resource_type: string;              // "EC2", "RDS", "EBS", etc.
  account_id: string;
  account_name: string;
  region: string;
  monthly_cost_inr: number;
  details: Record<string, any>;       // Type-specific details
  detection_reason: string;           // Human-readable reason
  suggested_action: SuggestedAction;
  safety_level: "safe" | "risky" | "irreversible";
  tags: Record<string, string>;
  owner_inferred?: string;
  created_at?: string;
  last_used?: string;
}

type WasteType =
  | "idle_ec2"
  | "idle_rds"
  | "unattached_ebs"
  | "stale_snapshot"
  | "unused_eip"
  | "orphaned_lb"
  | "zombie_nat"
  | "previous_gen"
  | "region_sprawl"
  | "unused_log_group";

interface SuggestedAction {
  action: string;                     // "stop", "terminate", "delete", "resize", "create_endpoint"
  requires_approval: boolean;
  auto_executable_at_level: 1 | 2 | 3 | null;  // null = always needs approval
  estimated_savings_monthly: number;
  risk_description?: string;
  rollback_possible: boolean;
}

// Rightsizing recommendation
interface RightsizingRecommendation {
  instance_id: string;
  region: string;
  account_id: string;
  current_type: string;
  recommended_type: string;
  current_monthly_cost: number;
  recommended_monthly_cost: number;
  savings_monthly: number;
  savings_pct: number;
  metrics: {
    cpu_avg: number;
    cpu_p99: number;
    memory_avg?: number;
    memory_p99?: number;
    network_avg_mbps: number;
  };
  confidence: "high" | "medium" | "low";
  reason: string;
  dependencies: ResourceDependency[];
  is_production: boolean;
}

// Action audit log entry
interface ActionLogEntry {
  timestamp: string;
  action_id: string;
  action: string;
  account_id: string;
  region: string;
  resource_id: string;
  resource_type: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  safety_snapshot?: string;
  autonomy_level: number;
  human_approval?: {
    approved_by: string;
    approved_at: string;
  } | null;
  health_check?: "passed" | "failed" | "skipped";
  rollback: boolean;
  rollback_reason?: string;
  estimated_savings_monthly_inr: number;
  initiated_by: "agent" | "user";
}

// Cost investigation result
interface CostInvestigation {
  investigation_id: string;
  triggered_by: string;              // "user_query" | "anomaly_detection" | "scheduled_review"
  period_analyzed: { start: string; end: string };
  baseline_period: { start: string; end: string };
  total_cost_change: { absolute: number; pct: number };
  root_causes: RootCause[];
  total_addressable_savings: number;
  recommended_actions: SuggestedAction[];
}

interface RootCause {
  rank: number;
  description: string;
  service: string;
  account_id: string;
  monthly_impact_inr: number;
  cause_type: "new_resource" | "usage_increase" | "pricing_change" | "misconfiguration" | "intentional";
  evidence: {
    cloudtrail_events?: any[];
    metric_changes?: any;
    resource_changes?: any;
  };
  actionable: boolean;
  suggested_fix?: string;
}

// Savings Plan model
interface SavingsPlanScenario {
  name: string;
  commitment_monthly_inr: number;
  term: "1yr" | "3yr";
  payment_option: "all_upfront" | "partial_upfront" | "no_upfront";
  upfront_cost_inr?: number;
  estimated_savings_monthly_inr: number;
  estimated_savings_annual_inr: number;
  coverage_pct: number;
  risk_level: "very_low" | "low" | "medium" | "high";
  utilization_scenarios: {
    usage_change_pct: number;
    utilization_pct: number;
    net_savings_annual_inr: number;
  }[];
}
```

---

## 12. Development Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Description | Priority |
|------|-------------|----------|
| Project scaffolding | TypeScript project, Agent SDK, 3 MCP server skeletons | P0 |
| AWS credential management | AssumeRole chain, multi-account, external ID | P0 |
| Account discovery | Organizations API, list accounts, detect enabled regions | P0 |
| Cost breakdown tools | `get_cost_breakdown`, `get_cost_trend`, `get_top_cost_drivers` | P0 |
| Config management | Per-account config, autonomy levels, protection rules | P0 |
| Audit logging | Append-only JSONL action/approval/rollback logs | P0 |

### Phase 2: Waste Detection (Week 3-4)

| Task | Description | Priority |
|------|-------------|----------|
| Idle EC2 detection | CloudWatch CPU/network analysis, configurable thresholds | P0 |
| Unattached EBS detection | Volume state check, last attachment time | P0 |
| Stale snapshot detection | Cross-reference with existing volumes | P0 |
| Unused EIP detection | Association check | P0 |
| Idle RDS detection | Connection count analysis | P1 |
| Orphaned LB detection | Target health check | P1 |
| Zombie NAT Gateway detection | Bytes processed analysis | P1 |
| `scan_all_waste` aggregator | Parallel execution, ranking, categorization | P0 |
| Multi-region scanning | Parallel region scanning per account | P0 |

### Phase 3: Investigation & Intelligence (Week 5-6)

| Task | Description | Priority |
|------|-------------|----------|
| Cost spike investigation | `investigate_cost_change` with CloudTrail correlation | P0 |
| Cost anomaly detection | Baseline comparison, threshold alerting | P0 |
| Resource ownership inference | Tags + CloudFormation + CloudTrail creator mapping | P1 |
| Dependency discovery | Security groups, ASG, target groups, ENIs | P1 |
| Region sprawl detection | Resources in unexpected regions | P1 |
| Previous-gen instance detection | Instance family generation comparison | P1 |

### Phase 4: Execution Engine (Week 7-8)

| Task | Description | Priority |
|------|-------------|----------|
| Safe actions | Stop/start instances, release EIPs, delete unattached EBS | P0 |
| Tiered autonomy enforcement | L1/L2/L3 routing, protection tag checks | P0 |
| Rightsizing execution | Stop → snapshot → resize → start → health check → rollback | P0 |
| Snapshot safety net | Automatic pre-action snapshots | P0 |
| Health monitoring post-action | Instance/RDS health verification with auto-rollback | P0 |
| Scheduled scaling | EventBridge schedule creation for start/stop | P1 |

### Phase 5: Optimization & Reporting (Week 9-10)

| Task | Description | Priority |
|------|-------------|----------|
| Savings Plan modeling | Usage analysis, scenario modeling, stress testing | P1 |
| Data transfer analysis | NAT/cross-AZ/egress breakdown, VPC endpoint recommendations | P1 |
| VPC endpoint creation | Automated VPC endpoint setup | P1 |
| S3 lifecycle optimization | Access pattern analysis, tiering recommendations | P2 |
| Cost Health Report | Weekly/monthly automated report generation | P1 |
| Notification integration | Slack, email, PagerDuty for alerts and reports | P1 |

### Phase 6: Multi-Customer & Polish (Week 11-12)

| Task | Description | Priority |
|------|-------------|----------|
| Multi-customer isolation | Separate configs, credentials, and contexts per customer | P1 |
| CloudFormation StackSet template | One-click IAM role deployment for customers | P1 |
| Onboarding wizard | Guided first-run account setup and initial assessment | P2 |
| Tag compliance module | Find untagged resources, auto-tag from CloudFormation/CloudTrail | P2 |
| Dashboard data export | JSON exports for Grafana/custom dashboards | P2 |
| Architecture recommendations | VPC endpoint suggestions, Graviton migration paths | P2 |

---

## 13. Cost Estimates

### Claude API Usage

| Operation | Model | Tokens (est.) | Cost (est.) |
|-----------|-------|---------------|-------------|
| Cost spike investigation (full chain) | Opus | ~15K input + 5K output | ~₹25 |
| Waste scan analysis (per account) | Sonnet | ~8K input + 3K output | ~₹4 |
| Rightsizing recommendation (per instance) | Sonnet | ~5K input + 2K output | ~₹2.50 |
| Savings Plan modeling | Opus | ~20K input + 8K output | ~₹35 |
| Data transfer analysis | Sonnet | ~10K input + 4K output | ~₹5 |
| Weekly waste scan (10 accounts) | Mixed | ~100K total | ~₹60 |
| Daily anomaly check | Haiku | ~3K input + 1K output | ~₹0.25 |
| Weekly report generation | Sonnet | ~15K input + 5K output | ~₹7 |

**Monthly agent cost (typical org with 10 accounts):**
- Daily anomaly checks (30×): ~₹7.50
- Weekly waste scans (4×): ~₹240
- Weekly reports (4×): ~₹28
- Ad-hoc investigations (~4/month): ~₹100
- Rightsizing analysis (~20 instances/month): ~₹50
- Savings Plan modeling (1×/quarter): ~₹35
- **Total agent cost: ~₹460/month**

**vs. savings generated: ₹1-5L+/month** — ROI is 200-1000×

### AWS API Costs

- Cost Explorer API: ₹0.85 per request (first 25/month free) → ~₹200/month
- CloudWatch GetMetricData: ₹0.25 per 1000 metrics → ~₹500/month for 10 accounts
- All other APIs (Describe*, List*): Free
- **Total AWS API cost: ~₹700/month**

---

## 14. Getting Started — Quick Setup

### Prerequisites

```bash
# 1. Claude Code CLI installed and authenticated
claude --version

# 2. AWS CLI configured with management account credentials
aws sts get-caller-identity

# 3. Node.js 18+
node --version
```

### Step 1: Deploy IAM Roles

```bash
# Deploy read-only role to all accounts via StackSet
aws cloudformation create-stack-set \
  --stack-set-name CostOptimizerReadRoles \
  --template-url https://your-bucket/cost-optimizer-read-role.yaml \
  --parameters \
    ParameterKey=AgentAccountId,ParameterValue=$(aws sts get-caller-identity --query Account --output text) \
    ParameterKey=ExternalId,ParameterValue=$(uuidgen) \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy to all accounts in the Org
aws cloudformation create-stack-instances \
  --stack-set-name CostOptimizerReadRoles \
  --deployment-targets OrganizationalUnitIds=r-root \
  --regions us-east-1
```

### Step 2: Initialize the Agent

```bash
claude

> "Set up the Cloud Cost Optimization Agent for my AWS Organization."
```

The agent will:
1. Discover all accounts and regions
2. Run the initial Cost Health Assessment
3. Present findings and savings opportunities
4. Ask you to configure autonomy levels per account

### Step 3: Ongoing Usage

```bash
> "Why did our bill spike this month?"          # Cost investigation
> "Scan for waste across all accounts."         # Waste detection
> "Set up dev schedules."                       # Scheduled scaling
> "What Savings Plans should we buy?"           # SP optimization
> "Show me data transfer costs."                # Transfer analysis
> "What did the agent do this week?"            # Review actions taken
```

---

## 15. Integration with Other Agents

### SOC 2 Compliance Agent

Cost optimization actions may have compliance implications:
- Agent respects `compliance-locked` tags — never modifies compliance-critical resources
- Audit trail satisfies SOC 2 change management evidence requirements
- Cost reports can feed into SOC 2 operational effectiveness evidence

### Vendor Onboarding Agent

When new AWS service vendors are onboarded:
- Cost agent tracks vendor-specific AWS Marketplace spending
- Monitors if new vendor services are cost-efficient vs alternatives

### Statutory Compliance Calendar Agent

For Indian businesses on AWS:
- GST implications of AWS billing (reverse charge mechanism on imported services)
- TDS applicability on AWS payments
- Cost reports feed into financial compliance tracking

---

## 16. References

- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-api.html) — Cost and usage data
- [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/) — Multi-account management
- [AWS CloudTrail](https://docs.aws.amazon.com/cloudtrail/latest/userguide/) — API audit logging
- [AWS CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/) — Resource metrics
- [AWS Savings Plans](https://docs.aws.amazon.com/savingsplans/latest/userguide/) — Commitment-based discounts
- [AWS Well-Architected Framework — Cost Optimization Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/) — Best practices
- [FinOps Foundation](https://www.finops.org/) — Cloud financial management framework
- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/agents) — Agent SDK reference
- [Deep Agent Infrastructure Playbook](deep-agent-infrastructure-playbook.md) — Shared infrastructure patterns for all agents in this repository
