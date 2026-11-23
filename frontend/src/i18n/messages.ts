export type Locale = "en" | "zh";

export interface DemoStepCopy {
  tag: string;
  title: string;
  desc: string;
}

export interface Messages {
  brandSub: string;
  networkLive: string;
  networkSyncing: string;
  networkOffline: string;
  networkPendingDeployment: string;
  submitClaim: string;
  connectWallet: string;
  pureOrbit: string;
  exitPureOrbit: string;
  soundOn: string;
  soundOff: string;
  demoBtn: string;
  demoBadge: string;
  demoExit: string;
  demoPlay: string;
  demoPause: string;
  demoPrev: string;
  demoNext: string;
  demoSteps: DemoStepCopy[];
  filterAll: string;
  filterActive: string;
  filterVerified: string;
  filterRefuted: string;
  filterInconclusive: string;
  cruiseHint: string;
  globeControlsSpin: string;
  globeControlsPause: string;
  globeControlsSonar: string;
  globeControlsReset: string;
  globeControlsClouds: string;
  globeThemeEarth: string;
  globeThemeTwilight: string;
  globeThemeCrystal: string;
  globeInteractionTip: string;
  validatorCardTitle: string;
  validatorRole: string;
  validatorStatusOnline: string;
  validatorPingBtn: string;
  caseHeader: string;
  criteriaLabel: string;
  webSourcesLabel: string;
  primarySource: string;
  secondarySource: string;
  consensusTitle: string;
  consensusSubtitle: string;
  confidence: string;
  adjudicationsCount: string;
  adjudicateBtn: string;
  readjudicateBtn: string;
  adjudicatingBtn: string;
  connectToAdjudicate: string;
  expandEvidence: string;
  collapseEvidence: string;
  evidenceExcerpt: string;
  verdictSummary: string;
  fingerprintTitle: string;
  contractLabel: string;
  chainLabel: string;
  submitterLabel: string;
  adjudicatorLabel: string;
  copyDone: string;
  txSubmitted: string;
  txFetchingWeb: string;
  txValidatorsVoting: string;
  txFinalized: string;
  txFailed: string;
  txSwitching: string;
  txSignPrompt: string;
  txHashLabel: string;
  modalTitle: string;
  modalSubtitle: string;
  fieldTitle: string;
  fieldCategory: string;
  fieldRegion: string;
  fieldCriteria: string;
  fieldPrimaryUrl: string;
  fieldSecondaryUrl: string;
  pinOnGlobeBtn: string;
  pinActiveBanner: string;
  cancelPin: string;
  submitBtn: string;
  submittingBtn: string;
  walletModalTitle: string;
  walletModalSubtitle: string;
  walletDetected: string;
  walletNoneDetected: string;
  walletDisconnect: string;
  walletSwitchNetwork: string;
  walletWrongChain: string;
  gaslessHint: string;
  statusLabels: Record<string, string>;
  sourceStates: Record<string, string>;
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    brandSub: "GLOBAL FACT ADJUDICATION",
    networkLive: "STUDIONET · LIVE",
    networkSyncing: "SYNCING CHAIN",
    networkOffline: "RPC RETRYING",
    networkPendingDeployment: "DEPLOYMENT PENDING",
    submitClaim: "SUBMIT CLAIM",
    connectWallet: "Connect Wallet",
    pureOrbit: "Pure Orbit",
    exitPureOrbit: "Show Dossier",
    soundOn: "Crystal Audio On",
    soundOff: "Crystal Audio Off",
    demoBtn: "Demo Flow",
    demoBadge: "ILLUSTRATED WALKTHROUGH · NO TRANSACTION",
    demoExit: "Exit Demo",
    demoPlay: "Auto Play",
    demoPause: "Pause",
    demoPrev: "Prev",
    demoNext: "Next",
    demoSteps: [
      {
        tag: "STEP 01 · SPATIAL ANCHOR",
        title: "Anchor a Real-World Claim on Earth",
        desc: "A claim headline, verification criteria, and authoritative HTTPS URLs are pinned to real coordinates on GenLayer StudioNet.",
      },
      {
        tag: "STEP 02 · LIVE WEB FETCH",
        title: "GenVM Fetches Live Dual Web Evidence",
        desc: "In a live transaction, validators independently retrieve the cited RFC text and verify its publication and revision metadata.",
      },
      {
        tag: "STEP 03 · OPTIMISTIC DEMOCRACY",
        title: "Independent Evidence Agreement",
        desc: "The beam paths illustrate independent validator checks. They do not identify validators or report vote counts.",
      },
      {
        tag: "STEP 04 · ON-CHAIN FINALITY",
        title: "Verdict & Proof Permanently Recorded",
        desc: "In a live case, finality and successful execution are checked before the accepted verdict and evidence are displayed.",
      },
    ],
    filterAll: "ALL",
    filterActive: "ACTIVE",
    filterVerified: "VERIFIED",
    filterRefuted: "REFUTED",
    filterInconclusive: "INCONCLUSIVE",
    cruiseHint: "Cruise Orbit (← / →)",
    globeControlsSpin: "Auto Spin",
    globeControlsPause: "Pause Spin",
    globeControlsSonar: "Sonar Ping",
    globeControlsReset: "Reset View",
    globeControlsClouds: "Toggle Live Clouds",
    globeThemeEarth: "Real Earth",
    globeThemeTwilight: "Orbital Night",
    globeThemeCrystal: "Crystal",
    globeInteractionTip: "Drag Earth · Double-click for Sonar Scan · Click V1–V5 nodes",
    validatorCardTitle: "CONSENSUS VISUALIZATION",
    validatorRole: "Illustrative position on the globe",
    validatorStatusOnline: "ILLUSTRATIVE",
    validatorPingBtn: "Play Light Pulse",
    caseHeader: "ADJUDICATION CASE",
    criteriaLabel: "RESOLUTION CRITERIA",
    webSourcesLabel: "LIVE WEB EVIDENCE SOURCES",
    primarySource: "Primary Source",
    secondarySource: "Secondary Source",
    consensusTitle: "Consensus",
    consensusSubtitle: "Illustrative stages",
    confidence: "Confidence",
    adjudicationsCount: "Runs",
    adjudicateBtn: "Trigger On-Chain Adjudication",
    readjudicateBtn: "Re-Run Live Adjudication",
    adjudicatingBtn: "Validators Converging...",
    connectToAdjudicate: "Connect Wallet to Adjudicate",
    expandEvidence: "Inspect Consensus Reasoning & Quote",
    collapseEvidence: "Hide Reasoning",
    evidenceExcerpt: "VERBATIM SOURCE EXCERPT",
    verdictSummary: "AI VALIDATOR SUMMARY",
    fingerprintTitle: "On-Chain Verification Fingerprint",
    contractLabel: "Intelligent Contract",
    chainLabel: "Network",
    submitterLabel: "Submitter",
    adjudicatorLabel: "Last Adjudicator",
    copyDone: "Copied",
    txSwitching: "Switching wallet to StudioNet (61999)...",
    txSignPrompt: "Confirm transaction in your wallet...",
    txSubmitted: "Transaction broadcast to GenLayer mempool...",
    txFetchingWeb: "Adjudication submitted to GenLayer…",
    txValidatorsVoting: "Waiting for GenLayer finality…",
    txFinalized: "On-chain consensus finalized and recorded.",
    txFailed: "Transaction execution reverted or rejected.",
    txHashLabel: "Tx Hash",
    modalTitle: "Submit Public Fact Claim",
    modalSubtitle: "Pin a claim about an official RFC and specify the publication cutoff and section.",
    fieldTitle: "Claim Headline",
    fieldCategory: "Category",
    fieldRegion: "Location Label",
    fieldCriteria: "Objective Verification Criteria",
    fieldPrimaryUrl: "Official RFC Editor .txt URL",
    fieldSecondaryUrl: "Official successor RFC .txt URL (optional)",
    pinOnGlobeBtn: "Pin on Earth",
    pinActiveBanner: "Click anywhere on the 3D Earth to drop your spatial anchor",
    cancelPin: "Cancel Pin",
    submitBtn: "Publish to StudioNet",
    submittingBtn: "Publishing On-Chain...",
    walletModalTitle: "Connect Multi-Wallet",
    walletModalSubtitle: "Auto-discovered via EIP-6963 · StudioNet (61999) is gasless",
    walletDetected: "Detected Browser Wallets",
    walletNoneDetected:
      "No EVM wallet extension detected. Install MetaMask, Rabby, OKX, or Bitget Wallet to sign on-chain writes. Read-only browsing works without a wallet.",
    walletDisconnect: "Disconnect",
    walletSwitchNetwork: "Switch to StudioNet (61999)",
    walletWrongChain: "Wrong Network",
    gaslessHint: "0 GEN required on StudioNet",
    statusLabels: {
      ACTIVE: "AWAITING VERDICT",
      VERIFIED: "VERIFIED ON-CHAIN",
      REFUTED: "REFUTED ON-CHAIN",
      INCONCLUSIVE: "INCONCLUSIVE",
    },
    sourceStates: {
      REACHABLE: "LIVE VERIFIED",
      PENDING: "PENDING CHECK",
      EMPTY: "EMPTY BODY",
      UNAVAILABLE: "UNREACHABLE",
      NONE: "NOT SET",
    },
  },
  zh: {
    brandSub: "全球实时事实裁决星图",
    networkLive: "STUDIONET · 已连通",
    networkSyncing: "链上同步中",
    networkOffline: "节点重连中",
    networkPendingDeployment: "等待部署",
    submitClaim: "提交新声明",
    connectWallet: "连接钱包",
    pureOrbit: "纯净观星",
    exitPureOrbit: "展开卷宗",
    soundOn: "水晶声效已开",
    soundOff: "水晶声效已关",
    demoBtn: "流程演示",
    demoBadge: "流程示意 · 无交易",
    demoExit: "退出演示",
    demoPlay: "自动播放",
    demoPause: "暂停",
    demoPrev: "上一步",
    demoNext: "下一步",
    demoSteps: [
      {
        tag: "步骤 01 · 空间落标",
        title: "将现实世界事实锚定到真实地球坐标",
        desc: "在 GenLayer StudioNet 合约中登记公开声明、客观核验标准以及官方 HTTPS 权威数据源，并在 3D 地球精准落标。",
      },
      {
        tag: "步骤 02 · 实时双源抓网",
        title: "GenVM 合约直接抓取实时公开网页",
        desc: "真实交易中，验证者独立读取指定的 RFC 原文，并核对发布时间和版本承接关系。",
      },
      {
        tag: "步骤 03 · 乐观民主共识",
        title: "验证者独立核对证据",
        desc: "光束用于示意验证者各自核对证据的过程，不代表实际节点位置或投票数。",
      },
      {
        tag: "步骤 04 · 链上终裁存证",
        title: "裁决结论与原文证据永久写死上链",
        desc: "真实案例在交易终局、执行成功并读回链上数据后，显示裁决状态及原文证据。",
      },
    ],
    filterAll: "全部",
    filterActive: "待裁决",
    filterVerified: "已证实",
    filterRefuted: "已证伪",
    filterInconclusive: "存疑",
    cruiseHint: "轨道巡航 (← / →)",
    globeControlsSpin: "开启自转",
    globeControlsPause: "暂停自转",
    globeControlsSonar: "声呐扫描",
    globeControlsReset: "重置视角",
    globeControlsClouds: "开关动态云层",
    globeThemeEarth: "真实地球",
    globeThemeTwilight: "晨昏夜景",
    globeThemeCrystal: "蓝晶模式",
    globeInteractionTip: "拖拽地球 · 双击发射声呐扫描 · 点击 V1–V5 节点查看详情",
    validatorCardTitle: "共识可视化",
    validatorRole: "地球上的示意位置",
    validatorStatusOnline: "示意节点",
    validatorPingBtn: "播放光束",
    caseHeader: "链上裁决卷宗",
    criteriaLabel: "客观核验标准",
    webSourcesLabel: "实时公开网页证据源",
    primarySource: "主权威数据源",
    secondarySource: "副交叉验证源",
    consensusTitle: "共识状态",
    consensusSubtitle: "阶段示意",
    confidence: "置信度",
    adjudicationsCount: "裁决次数",
    adjudicateBtn: "发起链上 AI 共识裁决",
    readjudicateBtn: "重新抓取实时网页复核",
    adjudicatingBtn: "验证者节点汇聚中...",
    connectToAdjudicate: "连接钱包后发起裁决",
    expandEvidence: "展开 AI 共识理由与原文摘录",
    collapseEvidence: "收起详情",
    evidenceExcerpt: "网页原文摘录",
    verdictSummary: "AI 验证者共识摘要",
    fingerprintTitle: "链上存证指纹",
    contractLabel: "智能合约地址",
    chainLabel: "目标网络",
    submitterLabel: "提交地址",
    adjudicatorLabel: "最近裁决触发者",
    copyDone: "已复制",
    txSwitching: "正在切换钱包至 StudioNet (61999)...",
    txSignPrompt: "请在钱包弹窗中确认签名...",
    txSubmitted: "交易已广播至 GenLayer 网络...",
    txFetchingWeb: "裁决交易已提交至 GenLayer…",
    txValidatorsVoting: "等待 GenLayer 共识终结…",
    txFinalized: "链上共识已终结并永久写入状态。",
    txFailed: "交易被拒绝或合约执行回滚。",
    txHashLabel: "交易哈希",
    modalTitle: "登记公开事实声明",
    modalSubtitle: "为官方 RFC 声明落标，并指定截止月份和章节。",
    fieldTitle: "声明标题",
    fieldCategory: "分类标签",
    fieldRegion: "地理坐标名称",
    fieldCriteria: "客观核验标准",
    fieldPrimaryUrl: "RFC Editor 官方 .txt 网址",
    fieldSecondaryUrl: "正式替代 RFC 的 .txt 网址（选填）",
    pinOnGlobeBtn: "点地球落标",
    pinActiveBanner: "请直接点击 3D 地球表面任意位置，锚定声明坐标",
    cancelPin: "取消落标",
    submitBtn: "提交写入 StudioNet",
    submittingBtn: "链上写入中...",
    walletModalTitle: "多钱包连接",
    walletModalSubtitle: "支持 EIP-6963 自动发现 · StudioNet (61999) 免 Gas",
    walletDetected: "已检测到浏览器钱包",
    walletNoneDetected:
      "未检测到 EVM 钱包插件。请安装 MetaMask、Rabby、OKX 或 Bitget 钱包以发起链上写入；浏览真实链上数据无需连接钱包。",
    walletDisconnect: "断开连接",
    walletSwitchNetwork: "一键切换 StudioNet (61999)",
    walletWrongChain: "网络不匹配",
    gaslessHint: "StudioNet 测试网免 Gas（0 GEN 即可）",
    statusLabels: {
      ACTIVE: "待裁决",
      VERIFIED: "链上已证实",
      REFUTED: "链上已证伪",
      INCONCLUSIVE: "证据存疑",
    },
    sourceStates: {
      REACHABLE: "实时抓网通过",
      PENDING: "待抓取核验",
      EMPTY: "正文为空",
      UNAVAILABLE: "暂不可达",
      NONE: "未设置",
    },
  },
};
