#include <frc2/command/Commands.h>

namespace cmd {
    frc2::CommandPtr TESTDriveInASquare();
    frc2::CommandPtr TESTForward250cm();
    frc2::CommandPtr TESTForward250cmWhileTurning();

    // frc2::CommandPtr NeutralOnePassAndClimb_LeftBump();
    // frc2::CommandPtr NeutralOnePassAndClimb_LeftTrench();
    // frc2::CommandPtr NeutralOnePassAndClimb_LeftTrench_NoBump();

    // frc2::CommandPtr NeutralOnePassAndClimb_RightBump();
    // frc2::CommandPtr NeutralOnePassAndClimb_RightTrench();
    // frc2::CommandPtr NeutralOnePassAndClimb_RightTrench_NoBump();

    frc2::CommandPtr Hoard_LeftBump();
    frc2::CommandPtr Hoard_LeftTrench();
    frc2::CommandPtr Hoard_RightBump();
    frc2::CommandPtr Hoard_RightTrench();

    frc2::CommandPtr NeutralOnePassAndOutpost_RightBump();
    frc2::CommandPtr NeutralOnePassAndOutpost_RightTrench();
    frc2::CommandPtr NeutralOnePassAndOutpost_RightTrench_NoBump();
    
    // frc2::CommandPtr NeutralOnePassOutpostClimb_RightTrench();
    // frc2::CommandPtr NeutralOnePassOutpostClimb_RightTrench_NoBump();

    frc2::CommandPtr NeutralTwoPass_LeftTrench();
    frc2::CommandPtr NeutralTwoPassToOutpost_RightTrench();
    frc2::CommandPtr NeutralTwoPassToMid_LeftTrench();
    frc2::CommandPtr NeutralTwoPassToMid_RightTrench();

    frc2::CommandPtr ShootAndStay();

    frc2::CommandPtr AutoZeroGyroFromVision();
    
    frc2::CommandPtr AutonomousShoot(units::second_t shootTime);
}