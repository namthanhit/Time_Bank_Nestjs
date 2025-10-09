import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './typings/create-user.dto';
import { UpdateUserDto } from './typings/users.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string
  ) {
    return this.usersService.getUserDetailById(id);
  }

  @Patch('/me/edit-profile/:id')
  update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.updateUserById(id, updateUserDto);
  }
}
