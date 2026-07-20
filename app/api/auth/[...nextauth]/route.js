import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "../../../lib/db";
import { Driver } from "../../../models/schema";
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        await connectDB();

        const driver = await Driver.findOne({ email: credentials.email });

        if (!driver) throw new Error("Driver not found");

        const isValid = await bcrypt.compare(
          credentials.password,
          driver.password
        );

        if (!isValid) throw new Error("Invalid password");
        let user = driver;
        return user;
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account.provider === "google") {
        await connectDB();
        const existingDriver = await Driver.findOne({ email: user.email });
        if (!existingDriver) {
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          await connectDB();
          const dbDriver = await Driver.findOne({ email: user.email });
          token.id = dbDriver?._id?.toString();
          token.name = dbDriver?.name;
          token.role = dbDriver?.role || "driver";
        } else {
          token.id = user._id?.toString();
          token.name = user.name;
          token.role = user.role || "driver";
        }
        token.email = user.email;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
      };
      return session;
    },
  },

  pages: {
    signIn: "/sign-in",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };