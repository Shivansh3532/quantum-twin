import "reflect-metadata"; import { Controller, Get, Module, Post } from "@nestjs/common"; import { workflow } from "./crypto.ts";
@Controller() class AppController { @Get("health") health() { return { ok: true }; } @Post("workflow") workflow() { return workflow(); } }
@Module({ controllers: [AppController] }) export class AppModule {}
