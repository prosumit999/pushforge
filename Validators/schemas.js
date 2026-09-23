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
    eventType: z.enum(["pageview", "session_start", "session_end", "click"]),
    path: z.string().optional(),
    duration: z.number().optional(),
    referrer: z.string().optional(),
    location: z.object({
      country: z.string().optional(),
      city: z.string().optional()
    }).optional(),
    device: z.object({
      browser: z.string().optional(),
      os: z.string().optional(),
      deviceType: z.string().optional()
    }).optional()
  })
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
        icon: z.string().optional()
      })
    ).optional(),
    targetType: z.enum(["all", "segment", "filter"]).optional(),
    segment: z.string().optional(),
    scheduledAt: z.string().optional(),
    isTemplate: z.boolean().optional(),
    templateName: z.string().optional()
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  createWebsiteSchema,
  updateWebsiteSchema,
  publicSubscribeSchema,
  publicEventSchema,
  createSegmentSchema,
  createNotificationSchema
};
