const { z } = require("zod");

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters long").trim(),
    email: z.string().email("Invalid email address format").trim().toLowerCase(),
    password: z.string().min(6, "Password must be at least 6 characters long")
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address format").trim().toLowerCase(),
    password: z.string().min(1, "Password is required")
  })
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long")
  })
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address format").optional()
  })
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address format").optional(),
    token: z.string().min(1, "Verification code is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long")
  })
});

const createWebsiteSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Website name must be at least 2 characters long").trim(),
    domain: z.string().min(3, "Domain name is required").trim(),
    timezone: z.string().optional()
  })
});

const updateWebsiteSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    domain: z.string().min(3).trim().optional(),
    timezone: z.string().optional(),
    status: z.enum(["active", "paused", "unverified"]).optional()
  })
});

const publicSubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url("Endpoint must be a valid URL"),
    keys: z.object({
      p256dh: z.string().min(1, "p256dh key is required"),
      auth: z.string().min(1, "auth key is required")
    }),
    device: z.object({
      browser: z.string().optional(),
      os: z.string().optional(),
      deviceType: z.string().optional()
    }).optional(),
    location: z.object({
      ip: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional()
    }).optional(),
    referrer: z.string().optional(),
    firstSeenPage: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
});

const publicEventSchema = z.object({
  body: z.object({
    eventType: z.string().min(1, "eventType is required"),
    campaignId: z.string().optional().nullable(),
    action: z.string().optional().nullable(),
    path: z.string().optional().nullable(),
    duration: z.number().optional().nullable(),
    referrer: z.string().optional().nullable(),
    landingPage: z.string().optional().nullable(),
    location: z.any().optional().nullable(),
    device: z.any().optional().nullable()
  }).passthrough()
});

const createSegmentSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Segment name must be at least 2 characters long").trim(),
    rules: z.array(
      z.object({
        field: z.string().min(1, "Rule field is required"),
        operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "in"]),
        value: z.any()
      })
    ).optional()
  })
});

// Shared shape for segment rules and ad-hoc audience filters. The allowed
// field names themselves are enforced by the audience service allowlist, which
// is also what blocks operator injection.
const audienceRuleSchema = z.object({
  field: z.string().min(1, "Rule field is required"),
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "in"]),
  value: z.any()
});

const createNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Notification title is required").max(200, "Title too long").trim(),
    body: z.string().min(1, "Notification body is required").max(1000, "Body too long").trim(),
    icon: z.string().optional(),
    badge: z.string().optional(),
    image: z.string().optional(),
    clickUrl: z.string().optional(),
    actionButtons: z.array(
      z.object({
        action: z.string(),
        title: z.string(),
        icon: z.string().optional(),
        url: z.string().optional()
      })
    ).optional(),
    targetType: z.enum(["all", "segment", "filter"]).optional(),
    segment: z.string().optional(),
    filterRules: z.array(audienceRuleSchema).max(25, "A maximum of 25 filter rules is allowed").optional(),
    scheduledAt: z.string().optional(),
    isTemplate: z.boolean().optional(),
    templateName: z.string().optional()
  })
});

const updateTemplateSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Template title is required").max(200, "Title too long").trim().optional(),
    body: z.string().min(1, "Template body is required").max(1000, "Body too long").trim().optional(),
    icon: z.string().optional(),
    badge: z.string().optional(),
    image: z.string().optional(),
    clickUrl: z.string().optional(),
    templateName: z.string().max(120, "Template name too long").trim().optional(),
    actionButtons: z.array(
      z.object({
        action: z.string(),
        title: z.string(),
        icon: z.string().optional(),
        url: z.string().optional()
      })
    ).optional()
  })
});

const audiencePreviewSchema = z.object({
  body: z.object({
    targetType: z.enum(["all", "segment", "filter"]).optional(),
    segmentId: z.string().optional(),
    rules: z.array(audienceRuleSchema).max(25, "A maximum of 25 filter rules is allowed").optional()
  })
});

const testSendSchema = z.object({
  body: z.object({
    subscriberId: z.string().min(1, "subscriberId is required")
  })
});

const scheduleNotificationSchema = z.object({
  body: z.object({
    scheduledAt: z
      .string()
      .min(1, "scheduledAt is required")
      .refine((value) => !Number.isNaN(new Date(value).getTime()), "scheduledAt must be a valid date")
  })
});

const publicClickSchema = z.object({
  body: z.object({
    campaignId: z.string().optional().nullable(),
    action: z.string().optional(),
    url: z.string().optional(),
    path: z.string().optional(),
    trackingId: z.string().optional(),
    // Push endpoint reported by the service worker, used for attribution.
    endpoint: z.string().optional().nullable(),
    timestamp: z.string().optional()
  })
});

const publicSubscriptionChangeSchema = z.object({
  body: z.object({
    oldEndpoint: z.string().optional().nullable(),
    newSubscription: z.object({
      endpoint: z.string().url("Endpoint must be a valid URL"),
      keys: z.object({
        p256dh: z.string().optional(),
        auth: z.string().optional()
      }).optional()
    })
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createWebsiteSchema,
  updateWebsiteSchema,
  publicSubscribeSchema,
  publicEventSchema,
  publicClickSchema,
  publicSubscriptionChangeSchema,
  createSegmentSchema,
  createNotificationSchema,
  scheduleNotificationSchema,
  audiencePreviewSchema,
  testSendSchema,
  updateTemplateSchema
};
