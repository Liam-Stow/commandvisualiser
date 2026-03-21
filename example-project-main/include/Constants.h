#pragma once

namespace canid {
    constexpr int DRIVEBASE_FRONT_RIGHT_DRIVE = 1; 
    constexpr int DRIVEBASE_FRONT_RIGHT_TURN = 2;
    constexpr int DRIVEBASE_FRONT_RIGHT_ENCODER = 3; 

    constexpr int DRIVEBASE_FRONT_LEFT_DRIVE = 4;
    constexpr int DRIVEBASE_FRONT_LEFT_TURN = 5;
    constexpr int DRIVEBASE_FRONT_LEFT_ENCODER = 6;
        
    constexpr int DRIVEBASE_BACK_RIGHT_DRIVE = 7; 
    constexpr int DRIVEBASE_BACK_RIGHT_TURN = 8;
    constexpr int DRIVEBASE_BACK_RIGHT_ENCODER = 9; 

    constexpr int DRIVEBASE_BACK_LEFT_DRIVE = 10; 
    constexpr int DRIVEBASE_BACK_LEFT_TURN = 11;
    constexpr int DRIVEBASE_BACK_LEFT_ENCODER = 12; 

    constexpr int PIGEON_2 = 13; 

    constexpr int INTAKE = 14;
    constexpr int INTAKE_FOLLOWER = 15;
    constexpr int INDEXER = 16;
    constexpr int FEEDER = 17;
    constexpr int DEPLOY = 18;
    constexpr int HOOD_MOTOR = 19; 
    constexpr int SHOOTER_MOTOR_1 = 20; 
    constexpr int SHOOTER_MOTOR_2 = 21;  
    constexpr int TURRET_MOTOR = 22; 

    constexpr int TURRET_ENCODER_1 = 25;
    constexpr int TURRET_ENCODER_2 = 24;

    constexpr int PDH = 40;
}

namespace dio {
    constexpr int BRAKE_COAST_BUTTON = 0;
    constexpr int TURRET_ENCODER_1 = 1;
    constexpr int TURRET_ENCODER_2 = 2;
}

namespace pwm {
    constexpr int LED = 0;
}

