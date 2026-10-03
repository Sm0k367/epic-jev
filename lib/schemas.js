// Capability schemas — each Epic Jev capability expressed as a System One
// typed-question schema (the protocol Clef and Jev both speak).
//
// `engine: 'decision'` runs on Clef/Jev and returns probabilities.
// `engine: 'generation'` needs a text LLM — Clef and Jev cannot generate
// free-form text at all, so summarisation and extraction are routed there.

export const CAPABILITIES = {
  evaluation: {
    label: 'Text Evaluation',
    icon: '📋',
    tab: 'core',
    engine: 'decision',
    blurb: 'Judge whether a statement is accurate, supported, and actionable.',
    example: 'Machine learning is a subset of artificial intelligence.',
    schema: (text) => ({
      state: text,
      questions: {
        accurate: {
          type: 'noul',
          instructions: 'Is this statement factually accurate?',
          criteria: { true: 'Correct as stated.', false: 'Contains a factual error.' },
        },
        supported: {
          type: 'noul',
          instructions: 'Is the claim specific enough to be verified?',
        },
        verdict: {
          type: 'choice',
          instructions: 'Overall verdict on this statement.',
          criteria: {
            accept: 'Accurate and well-formed; safe to rely on.',
            qualify: 'Broadly right but imprecise or missing conditions.',
            reject: 'Incorrect or misleading.',
          },
        },
        confidence: {
          type: 'score',
          instructions: 'How strongly should a human reviewer trust this statement?',
          criteria: ['Do not use', 'Needs review', 'Usable', 'High trust'],
        },
      },
    }),
  },

  classification: {
    label: 'Classification',
    icon: '🏷️',
    tab: 'core',
    engine: 'decision',
    blurb: 'Categorise text into a topic and register in one pass.',
    example: 'The KMS implementation is elegant and performant.',
    schema: (text) => ({
      state: text,
      questions: {
        topic: {
          type: 'choice',
          instructions: 'Which topic does this text belong to?',
          criteria: {
            technical: 'Engineering, systems, code, infrastructure.',
            business: 'Revenue, operations, strategy, customers.',
            support: 'A user asking for help or reporting a problem.',
            security: 'Authentication, authorisation, threats, compliance.',
            general: 'None of the above.',
          },
        },
        register: {
          type: 'choice',
          instructions: 'What register is the text written in?',
          criteria: {
            formal: 'Professional, measured, documentation-like.',
            neutral: 'Plain and factual.',
            casual: 'Informal, conversational.',
            emotional: 'Strongly felt, positive or negative.',
          },
        },
        actionable: {
          type: 'noul',
          instructions: 'Does this text require someone to take an action?',
        },
      },
    }),
  },

  sentiment: {
    label: 'Sentiment Analysis',
    icon: '😊',
    tab: 'content',
    engine: 'decision',
    blurb: 'Polarity, intensity, and whether the author is likely to churn.',
    example: 'I absolutely love this product! The quality is exceptional and customer service was amazing.',
    schema: (text) => ({
      state: text,
      questions: {
        polarity: {
          type: 'choice',
          instructions: 'What is the overall sentiment?',
          criteria: {
            very_positive: 'Delighted, enthusiastic praise.',
            positive: 'Satisfied, favourable.',
            neutral: 'Factual, no strong feeling.',
            negative: 'Unhappy, critical.',
            very_negative: 'Angry, hostile, or despairing.',
          },
        },
        intensity: {
          type: 'score',
          instructions: 'How intense is the emotion expressed?',
          criteria: ['Flat', 'Mild', 'Moderate', 'Strong', 'Extreme'],
        },
        churn_risk: {
          type: 'noul',
          instructions: 'Is this author at risk of leaving or cancelling?',
        },
        needs_reply: {
          type: 'noul',
          instructions: 'Should a human respond to this?',
        },
      },
    }),
  },

  intent: {
    label: 'Intent Detection',
    icon: '🎯',
    tab: 'content',
    engine: 'decision',
    blurb: 'Identify what the user wants and the next best action.',
    example: "Hi, I'm having issues with my account login. I've tried resetting my password but still can't access my account.",
    schema: (text) => ({
      state: text,
      questions: {
        intent: {
          type: 'choice',
          instructions: 'What is the user trying to do?',
          criteria: {
            get_support: 'Report a problem and get it fixed.',
            ask_question: 'Seek information.',
            purchase: 'Buy, upgrade, or start a trial.',
            complain: 'Express dissatisfaction.',
            cancel: 'Leave, unsubscribe, or request a refund.',
            small_talk: 'Greeting or off-topic.',
          },
        },
        emotion: {
          type: 'choice',
          instructions: 'What emotion is the user showing?',
          criteria: {
            calm: 'Neutral and composed.',
            confused: 'Uncertain, needs guidance.',
            frustrated: 'Annoyed but cooperative.',
            angry: 'Hostile or demanding.',
            happy: 'Pleased or thankful.',
          },
        },
        self_serve: {
          type: 'noul',
          instructions: 'Could a bot or help article resolve this without a human?',
        },
        urgency: {
          type: 'score',
          instructions: 'How urgent is this request?',
          criteria: ['Whenever', 'This week', 'Today', 'Right now'],
        },
      },
    }),
  },

  entity: {
    label: 'Entity Recognition',
    icon: '🏢',
    tab: 'content',
    engine: 'decision',
    blurb: 'Detect which entity classes are present and the dominant subject.',
    example: 'Sundar Pichai leads Google from Mountain View, driving innovation in cloud computing and AI.',
    schema: (text) => ({
      state: text,
      questions: {
        has_person: { type: 'noul', instructions: 'Does the text mention a specific person?' },
        has_org: { type: 'noul', instructions: 'Does the text mention an organisation or company?' },
        has_location: { type: 'noul', instructions: 'Does the text mention a place or location?' },
        has_money: { type: 'noul', instructions: 'Does the text mention a monetary amount?' },
        has_date: { type: 'noul', instructions: 'Does the text mention a date or time period?' },
        has_product: { type: 'noul', instructions: 'Does the text mention a product, service, or technology?' },
        dominant: {
          type: 'choice',
          instructions: 'Which entity class dominates the text?',
          criteria: {
            person: 'A named individual.',
            organisation: 'A company or institution.',
            location: 'A place.',
            product: 'A product or technology.',
            none: 'No clear dominant entity.',
          },
        },
      },
    }),
  },

  moderation: {
    label: 'Content Moderation',
    icon: '🚫',
    tab: 'safety',
    engine: 'decision',
    blurb: 'Policy verdict plus per-category violation probabilities.',
    example: 'This is professional business communication discussing project requirements.',
    schema: (text) => ({
      state: text,
      questions: {
        verdict: {
          type: 'choice',
          instructions: 'What moderation action should be taken?',
          criteria: {
            approve: 'No policy concern.',
            review: 'Borderline; a human should look.',
            block: 'Clear policy violation.',
          },
        },
        harassment: { type: 'noul', instructions: 'Does this harass, bully, or threaten a person?' },
        hate: { type: 'noul', instructions: 'Does this express hate toward a protected group?' },
        sexual: { type: 'noul', instructions: 'Does this contain sexual or adult content?' },
        violence: { type: 'noul', instructions: 'Does this promote or glorify violence?' },
        self_harm: { type: 'noul', instructions: 'Does this encourage self-harm?' },
        pii: { type: 'noul', instructions: 'Does this expose private personal information?' },
        spam: { type: 'noul', instructions: 'Is this spam, scam, or deceptive promotion?' },
      },
    }),
  },

  toxicity: {
    label: 'Toxicity Detection',
    icon: '☢️',
    tab: 'safety',
    engine: 'decision',
    blurb: 'Toxicity level, target, and publishability.',
    example: 'This is constructive feedback on improving the system architecture.',
    schema: (text) => ({
      state: text,
      questions: {
        toxic: { type: 'noul', instructions: 'Is this text toxic?' },
        level: {
          type: 'score',
          instructions: 'How toxic is it?',
          criteria: ['Clean', 'Mild', 'Harsh', 'Abusive', 'Severe'],
        },
        severe: { type: 'noul', instructions: 'Does it contain a severe insult or threat?' },
        targeted: { type: 'noul', instructions: 'Is the toxicity aimed at a specific person or group?' },
        obscene: { type: 'noul', instructions: 'Does it contain profanity or obscenity?' },
        publishable: { type: 'noul', instructions: 'Is it safe to publish without edits?' },
      },
    }),
  },

  fraud: {
    label: 'Fraud Detection',
    icon: '🔐',
    tab: 'safety',
    engine: 'decision',
    blurb: 'Risk tier and the specific signals that fired.',
    example: 'User purchased $49.99 item from familiar store in home city using verified card.',
    schema: (text) => ({
      state: text,
      questions: {
        risk: {
          type: 'choice',
          instructions: 'What is the fraud risk tier for this transaction?',
          criteria: {
            low: 'Consistent with the account history; approve.',
            medium: 'Some anomalies; step-up verification.',
            high: 'Multiple red flags; hold for manual review.',
            critical: 'Near-certain fraud; block.',
          },
        },
        score: {
          type: 'score',
          instructions: 'How likely is this to be fraudulent?',
          criteria: ['Very unlikely', 'Unlikely', 'Possible', 'Likely', 'Very likely'],
        },
        device_mismatch: { type: 'noul', instructions: 'Is the device or location unusual for this account?' },
        velocity: { type: 'noul', instructions: 'Is the purchase velocity abnormal?' },
        identity: { type: 'noul', instructions: 'Are there identity or verification concerns?' },
        chargeback: { type: 'noul', instructions: 'Is a chargeback or dispute likely?' },
        approve: { type: 'noul', instructions: 'Should this transaction be approved automatically?' },
      },
    }),
  },

  routing: {
    label: 'Smart Routing',
    icon: '📍',
    tab: 'ops',
    engine: 'decision',
    blurb: 'Pick the owning team, channel, and whether to escalate.',
    example: 'The API returns a 500 error when processing large datasets with our database integration.',
    schema: (text) => ({
      state: text,
      questions: {
        team: {
          type: 'choice',
          instructions: 'Which team should own this?',
          criteria: {
            technical_support: 'Outages, errors, configuration, bugs.',
            billing: 'Payments, invoices, refunds, subscriptions.',
            sales: 'Plans, upgrades, demos, quotes.',
            security: 'Compromise, access control, vulnerabilities.',
            success: 'Onboarding, adoption, how-to guidance.',
          },
        },
        channel: {
          type: 'choice',
          instructions: 'Which channel should handle it?',
          criteria: {
            self_serve: 'Docs or a bot can resolve it.',
            email: 'Asynchronous, non-urgent.',
            chat: 'Live agent, moderate urgency.',
            phone: 'Needs a real-time conversation.',
            on_call: 'Page an engineer now.',
          },
        },
        escalate: { type: 'noul', instructions: 'Should this be escalated above the first responder?' },
        customer_impact: {
          type: 'score',
          instructions: 'How many customers are affected?',
          criteria: ['None', 'One', 'A few', 'Many', 'All'],
        },
      },
    }),
  },

  priority: {
    label: 'Priority Scoring',
    icon: '⚠️',
    tab: 'ops',
    engine: 'decision',
    blurb: 'Severity, SLA target, and whether to page someone.',
    example: 'Multiple users report system is completely down and unable to access any services.',
    schema: (text) => ({
      state: text,
      questions: {
        severity: {
          type: 'score',
          instructions: 'How severe is this issue?',
          criteria: ['Cosmetic', 'Minor', 'Major', 'Critical', 'Catastrophic'],
        },
        priority: {
          type: 'choice',
          instructions: 'What priority should be assigned?',
          criteria: { p3: 'Backlog', p2: 'Normal queue', p1: 'Urgent', p0: 'Drop everything' },
        },
        sla: {
          type: 'choice',
          instructions: 'What response SLA applies?',
          criteria: {
            '1h': 'Respond within one hour.',
            '4h': 'Respond within four hours.',
            '1d': 'Respond within one business day.',
            '3d': 'Respond within three business days.',
          },
        },
        page: { type: 'noul', instructions: 'Should this page an on-call engineer immediately?' },
        revenue_impact: { type: 'noul', instructions: 'Is revenue actively being lost?' },
      },
    }),
  },

  // ── Generation capabilities (Clef/Jev cannot produce free-form text) ──────

  summarization: {
    label: 'Summarization',
    icon: '📝',
    tab: 'core',
    engine: 'generation',
    blurb: 'Compress to key points. Runs on a text LLM — decision models cannot generate prose.',
    example:
      'Jev excels at structured extraction, evaluation, and classification with 32K context and deterministic outputs, ideal for enterprise applications.',
    prompt: (text) =>
      `Summarise the following text.\n\nFirst give a one-sentence TL;DR.\nThen give 3-5 bullet points of the key facts.\nBe concise and do not add information that is not present.\n\nTEXT:\n${text}`,
  },

  extraction: {
    label: 'Data Extraction',
    icon: '🔍',
    tab: 'core',
    engine: 'generation',
    blurb: 'Pull structured fields out of unstructured text. Runs on a text LLM.',
    example:
      'Streaming delivers tokens in real-time, enabling responsive UIs with progressive rendering.',
    prompt: (text) =>
      `Extract structured data from the text below as JSON with these keys:\n` +
      `"entities" (array of {name, type}), "key_points" (array of strings), ` +
      `"numbers" (array of numbers found), "topics" (array of strings).\n` +
      `Return ONLY valid JSON, no prose.\n\nTEXT:\n${text}`,
    json: true,
  },
};

export const TABS = {
  core: 'Core Tasks',
  content: 'Content Analysis',
  safety: 'Safety & Compliance',
  ops: 'Routing & Operations',
  builder: 'App Builder',
};

export function capabilityIds() {
  return Object.keys(CAPABILITIES);
}
