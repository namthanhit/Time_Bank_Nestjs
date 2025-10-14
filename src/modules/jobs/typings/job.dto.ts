import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { JobVisibility } from "./job.enum";

export class CreateJobDto {
    @IsString()
    @IsNotEmpty({ message: "Title is required" })
    title: string;

    @IsString()
    @IsNotEmpty({ message: "Description is required" })
    description: string;

    @IsString()
    @IsNotEmpty({ message: "Region code is required" })
    region_code: string;

    @IsString()
    @IsNotEmpty({ message: "Place is required" })
    place: string;

    @IsString()
    @IsNotEmpty({ message: "Preferred start time is required" })
    preferred_start_time: string;

    @IsNumber()
    @IsNotEmpty({ message: "Time is required" })
    time: number;

    @IsNumber()
    @IsNotEmpty({ message: "Slot is required" })
    slot: number;

    @IsString()
    @IsNotEmpty({ message: "Visibility is required" })
    visibility: JobVisibility;

    @IsArray()
    @IsNotEmpty({ message: "Skills are required" })
    @IsString({ each: true })
    skills: string[];
}

export class UpdateJobDto {
    @IsString()
    title?: string;

    @IsString()
    description?: string;

    @IsString()
    region_code?: string;

    @IsString()
    place?: string;

    @IsDateString()
    preferred_start_time?: string;

    @IsNumber()
    time?: string;

    @IsNumber()
    slot?: number;

    @IsString()
    visibility?: JobVisibility;

    @IsString()
    status?: string;
}