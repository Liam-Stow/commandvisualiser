#pragma once

#include <frc/geometry/Translation2d.h>
#include <frc/controller/ProfiledPIDController.h>
#include <units/velocity.h>
#include "utilities/BotVars.h"

namespace DrivebaseConfig {
  // Drive controls
  constexpr units::meters_per_second_t MAX_VELOCITY = 4_mps;
  constexpr units::turns_per_second_t MAX_TELEOP_ANGULAR_VELOCITY = 290_deg_per_s;

  constexpr units::meters_per_second_t MAX_P2P_VELOCITY = 4_mps;
  constexpr units::meters_per_second_squared_t MAX_P2P_ACCEL = 15_mps_sq;
  constexpr units::turns_per_second_t MAX_P2P_ANGULAR_VELOCITY = 300_deg_per_s;
  constexpr units::turns_per_second_squared_t MAX_P2P_ANGULAR_ACCEL = 6_tr_per_s_sq;

  constexpr double MAX_JOYSTICK_ACCEL = 5;
  constexpr double MAX_ANGULAR_JOYSTICK_ACCEL = 3;
  constexpr double JOYSTICK_DEADBAND = 0.08;
  constexpr double TRANSLATION_SCALING = 2;  // Set to 1 for linear scaling
  constexpr double ROTATION_SCALING = 1;     // Set to 1 for linear scaling

  // Swerve config
  constexpr frc::Translation2d FL_POSITION{+0.281_m, +0.281_m};
  constexpr frc::Translation2d FR_POSITION{+0.281_m, -0.281_m};
  constexpr frc::Translation2d BL_POSITION{-0.281_m, +0.281_m};
  constexpr frc::Translation2d BR_POSITION{-0.281_m, -0.281_m};

  const units::turn_t FRONT_RIGHT_MAG_OFFSET = BotVars::Choose(-0.94384765625_tr - 0.25_tr, -0.446044921875_tr);
  const units::turn_t FRONT_LEFT_MAG_OFFSET = BotVars::Choose(-0.37451171875_tr + 0.25_tr, -0.26611328125_tr);
  const units::turn_t BACK_RIGHT_MAG_OFFSET = BotVars::Choose(-0.353515625_tr + 0.25_tr, -0.675048828125_tr);
  const units::turn_t BACK_LEFT_MAG_OFFSET = BotVars::Choose(-0.464111328125_tr - 0.25_tr, -0.824951171875_tr);

  // PID constants for translation and rotation controllers
  const frc::PIDController P2P_TRANSLATION_PID{5, 0, 0};
  const frc::PIDController P2P_ROTATION_PID{33, 0, 0};
}