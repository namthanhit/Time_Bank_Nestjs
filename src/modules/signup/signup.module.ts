import { Module } from "@nestjs/common";
import {AuthController } from "./signup.controller";
import { AuthService } from "./signup.service";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Module({
    controllers: [AuthController],
    providers: [AuthService, PrismaService],
    exports: [AuthService],
})
export class SignupModule {}