// import { PrismaClient } from "@prisma/client";

// const globalForPrisma = global as unknown as { prisma: PrismaClient };

// export const prisma =
//   globalForPrisma.prisma ||
//   new PrismaClient({
//     log: ["warn", "error"], // This will only log warnings and errors
//   });

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import { PrismaClient } from "@prisma/client";

// Extend the global object to include our Prisma instances
declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaReadOnly: PrismaClient | undefined;
}

// Primary database connection (read/write)
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = global.__prisma;
}

// Read-only database connection
// let prismaReadOnly: PrismaClient;

// if (process.env.NODE_ENV === "production") {
//   prismaReadOnly = new PrismaClient({
//     datasources: {
//       db: {
//         url: process.env.DATABASE_READ_ONLY_URL,
//       },
//     },
//   });
// } else {
//   if (!global.__prismaReadOnly) {
//     global.__prismaReadOnly = new PrismaClient({
//       datasources: {
//         db: {
//           url: process.env.DATABASE_READ_ONLY_URL,
//         },
//       },
//     });
//   }
//   prismaReadOnly = global.__prismaReadOnly;
// }

// export { prisma, prismaReadOnly };
export { prisma };
