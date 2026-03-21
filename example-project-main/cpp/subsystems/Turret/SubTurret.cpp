// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/Turret/SubTurret.h"
#include <frc/smartdashboard/SmartDashboard.h>
#include <frc/RobotBase.h>
#include "utilities/Logger.h"
#include "utilities/PoseHandler.h"
#include "subsystems/Turret/TurretEncoderConfig.h"
#include "utilities/RobotVisualisation.h"
#include <frc/RobotBase.h>

#include "subsystems/Turret/TurretThroughboreIO.h"
#include "subsystems/Turret/TurretCancoderIO.h"

SubTurret::SubTurret() {
    
    _turretMotorConfig.encoder.PositionConversionFactor(1/GEAR_RATIO);
    _turretMotorConfig.encoder.VelocityConversionFactor(1/GEAR_RATIO);
    _turretMotorConfig.closedLoop.Pid(P, I, D);
    _turretMotorConfig.closedLoop.feedForward.kS(kS.value());
    _turretMotorConfig.closedLoop.MaxOutput(1.0);
    _turretMotorConfig.closedLoop.MinOutput(-1.0);
    _turretMotorConfig.closedLoop.IMaxAccum(0.1);
    _turretMotorConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);
    _turretMotorConfig.SmartCurrentLimit(40);
    _turretMotorConfig.softLimit.ForwardSoftLimit(POS_LIMIT.convert<units::turns>().value());
    _turretMotorConfig.softLimit.ForwardSoftLimitEnabled(true);
    _turretMotorConfig.softLimit.ReverseSoftLimit(NEG_LIMIT.convert<units::turns>().value());
    _turretMotorConfig.softLimit.ReverseSoftLimitEnabled(true);
    _turretMotor.OverwriteConfig(_turretMotorConfig);

    if (BotVars::GetRobot() == BotVars::PRACTICE) {
        _encoderIO = std::make_unique<TurretThroughboreIO>(dio::TURRET_ENCODER_1, dio::TURRET_ENCODER_2);
    } else {
        _encoderIO = std::make_unique<TurretCancoderIO>(canid::TURRET_ENCODER_1, canid::TURRET_ENCODER_2);
    }

    _encoderIO->ConfigEncoder();

    frc::SmartDashboard::PutData("Turret/Motor", &_turretMotor);
}

// This method will be called once per scheduler run
void SubTurret::Periodic() {
    auto loopStart = frc::GetTime();
    units::celsius_t turretTemperature = _turretMotor.GetTemperature();
    units::ampere_t turretCurrent = _turretMotor.GetStatorCurrent();

    AlertController::UpdateTemperatureAlert(_turretAlertConfig, turretTemperature);
    AlertController::UpdateCurrentAlert(_turretAlertConfig, turretCurrent);

    if(_hasZeroed == false && _encoderIO->IsConnected()) {
        units::degree_t motorPosition = _turretMotor.GetPosition();
        units::degree_t crtPosition = GetTurretAngleCRT();
        Logger::Log("Turret/reset/motorPosition", motorPosition);
        Logger::Log("Turret/reset/crtPosition", crtPosition);

        bool CRTSameAsMotor = (units::math::abs(motorPosition - crtPosition) < 0.5_deg || frc::RobotBase::IsSimulation());
        Logger::Log("Turret/reset/CRTSameAsMotor", CRTSameAsMotor);

        if(CRTSameAsMotor){
            _hasZeroed = true;
        }
        if(!CRTSameAsMotor){
            _hasZeroed = false;
            ZeroTurret();
        }
    }

    if(GetTurretAngleCRT() > NEG_LIMIT && GetTurretAngleCRT() < POS_LIMIT) {
        _turretOutOfRangeAlert.Set(false);
    }

    else{
        _turretOutOfRangeAlert.Set(true);
    }

    RobotVisualisation::GetInstance()._turretMechCircle.SetAngle(_turretMotor.GetPosition());

    Logger::Log("Turret/Field Relative Turret Angle", GetFieldRelativeTurretAngle());
    Logger::Log("Turret/CRT Positiion", GetTurretAngleCRT());
    Logger::Log("Turret/Encoder/ZeroedEncoder1", getEncoder1Degrees());
    Logger::Log("Turret/Encoder/ZeroedEncoder2", getEncoder2Degrees());
    Logger::Log("Turret/Encoder/Encoder1", _encoderIO->GetRawEncoder1());
    Logger::Log("Turret/Encoder/Encoder2", _encoderIO->GetRawEncoder2());
    Logger::Log("Turret/hasReset", _hasZeroed);
    Logger::Log("Turret/IsAtTarget", IsAtTarget());

    Logger::Log("Turret/Encoder/EncodersAreConnected", _encoderIO->IsConnected());

    Logger::Log("Turret/Loop Time", (frc::GetTime() - loopStart));
    _turretPos.AddSample(frc::Timer::GetFPGATimestamp(), CalcOptimisedTurretAngle(_turretMotor.GetPosition()));
}

void SubTurret::SimulationPeriodic() {
    _turretSim.SetInputVoltage(_turretMotor.CalcSimVoltage());
    _turretSim.Update(20_ms);
    _turretMotor.IterateSim(_turretSim.GetAngularVelocity(), _turretSim.GetAngularPosition());
}

units::degree_t SubTurret::GetTurretAngleCRT() {

    if(frc::RobotBase::IsSimulation()) {
        return _turretMotor.GetPosition();
    }

    // get encoder values and difference
    double e1deg = getEncoder1Degrees().value();
    double e2deg = getEncoder2Degrees().value();

    double difference = e2deg - e1deg;

    Logger::Log("GetTurretAngleCRT/variables/difference before clamp", difference);

    // clamp difference
    if(difference > 180) {
        difference -= 360;
    } else if(difference < -180) {
        difference += 360;
    } 

    Logger::Log("GetTurretAngleCRT/variables/difference after clamp", difference);

    // find slope and multiply to difference 
    // (converting from encoder difference to turret degrees)
    static double SLOPE = (E2_TEETH * E1_TEETH) / (BIG_TEETH*(E1_TEETH-E2_TEETH));

    Logger::Log("GetTurretAngleCRT/variables/slope", SLOPE);

    difference *= SLOPE;

    Logger::Log("GetTurretAngleCRT/variables/difference *= slope", difference);

    // estimate encoder 1 rotation count
    // (solve for encoder 1 rotations)
    double e1rotations = (difference * BIG_TEETH / E1_TEETH) / 360.0;
    int e1rotations_floored = floor(e1rotations);

    Logger::Log("GetTurretAngleCRT/variables/e1 rotations", e1rotations);
    Logger::Log("GetTurretAngleCRT/variables/e1 rotations floored", e1rotations_floored);

    // solve for turret angle with encoder 1
    double turretAngle = (
        (e1rotations_floored * 360.0 + e1deg) *
        (E1_TEETH / BIG_TEETH)
    );

    Logger::Log("GetTurretAngleCRT/variables/turret angle", turretAngle);
    
    // resolve ambiguity (when encoders are the same again)
    double period = (E1_TEETH / BIG_TEETH) * 360.0;

    Logger::Log("GetTurretAngleCRT/variables/period", period);
    Logger::Log("GetTurretAngleCRT/variables/turretAngle before period", turretAngle);

    if(turretAngle - difference < -period / 2) {
        turretAngle += period;
    } else if(turretAngle - difference > period / 2) {
        turretAngle -= period;
    }

    Logger::Log("GetTurretAngleCRT/variables/turretAngle after period", turretAngle);

    // Move the zero angle to point at the robot's front (Intake) 
    return (turretAngle*1_deg) - turretZeroOffset;
}

units::degree_t SubTurret::GetTurretAngle() {
    return _turretMotor.GetPosition();
}

units::degree_t SubTurret::GetTurretAngleAtTime(units::second_t time) {
    auto sample = _turretPos.Sample(time);
    if (sample.has_value()) {
        return sample.value();
    } else {
        return GetTurretAngle();
    }
}

frc2::CommandPtr SubTurret::SetTurretTargetAngle(std::function<units::degree_t()> angle, std::function<units::degrees_per_second_t()> angVelTarget){
    return Run([this, angle, angVelTarget] {
        units::degrees_per_second_t nextVel = angVelTarget(); 

        units::volt_t rotationFeedforward = _robotRotVelFF.Calculate(nextVel);

        units::degree_t turretAngle = GetTurretAngle();
        Logger::Log("Turret/SetTurretTargetAngle/turretAngle", turretAngle);

        units::volt_t cableSpringFF = Logger::Tune("Turret/CableSpringFFVoltage", _cableSpringkS);

        // If the error is larger than 60_deg we do not use any rotationFeedforward (angular velocity FF)
        // This is so that we dont counteract our wraparound with rotationFF (so we can wrap quicker)
        if(units::math::abs( GetTurretAngle() - angle() ) > 60_deg) {
            rotationFeedforward = 0_V;
        }

        if(turretAngle > 155_deg) {
            rotationFeedforward += cableSpringFF;
        }

        if(turretAngle < 20_deg) {
            rotationFeedforward -= cableSpringFF;
        }

        Logger::Log("Turret/VelocityFeedForward/ffVolts", rotationFeedforward);
        Logger::Log("Turret/VelocityFeedForward/angVelTarget", nextVel);

        if(!_isLocked) {
            _turretMotor.SetPositionTarget(CalcOptimisedTurretAngle(angle()), rotationFeedforward);
            Logger::Log("Turret/SetTargetAngleWhileLocked", false);
        }
        if(_isLocked) {
            _turretMotor.SetPositionTarget(_turretMotor.GetPosition());
            Logger::Log("Turret/SetTargetAngleWhileLocked", true);
        }
        
    });
}

units::degree_t SubTurret::CalcOptimisedTurretAngle(units::degree_t angle) {
    units::degree_t currentAngle = SubTurret::GetInstance().GetTurretAngle();
    Logger::Log("Turret/CalcOptimisedTurretAngle/CurrentAngle", currentAngle);
    Logger::Log("Turret/CalcOptimisedTurretAngle/angle(input)", angle);

    //limit target angle to limits
    if(angle > POS_LIMIT) { angle -= 360_deg;}
    if(angle < NEG_LIMIT) { angle += 360_deg;}

    units::degree_t closestOffset = angle - currentAngle;

    // limit to +- 180 deg
    if(closestOffset > 180_deg) {
        closestOffset -= 360_deg;
    }
    if(closestOffset < -180_deg) {
        closestOffset += 360_deg;
    }
    
    Logger::Log("Turret/CalcOptimisedTurretAngle/closestOffset", closestOffset);

    units::degree_t newTarget = currentAngle + closestOffset;

    // clamp target to limits
    if(newTarget > POS_LIMIT) {
        newTarget -= 360_deg;
    }

    if(newTarget < NEG_LIMIT) {
        newTarget += 360_deg;
    }

    Logger::Log("Turret/CalcOptimisedTurretAngle/newTarget(final output)", newTarget);
    return newTarget;
}

units::degree_t SubTurret::GetTurretTargetAngle() {
    return _turretMotor.GetPositionTarget();
}

void SubTurret::SetTurretAngle(units::degree_t angle) {
    _turretMotor.SetPosition(angle);
}

void SubTurret::ZeroTurret() {
    if(!_isLocked) {
        Logger::Log("Turret/ZeroWhileLocked", false);
        units::degree_t turretAngle = GetTurretAngleCRT();
        if(turretAngle > NEG_LIMIT && turretAngle < POS_LIMIT) {
            SetTurretAngle(turretAngle);
            _turretMotor.SetPositionTarget(GetTurretAngleCRT());
            _turretOutOfRangeAlert.Set(false);
        }

        else{
            _turretOutOfRangeAlert.Set(true);
        }
    }

    if(_isLocked) {
        Logger::Log("Turret/ZeroWhileLocked", true);
    }
}

void SubTurret::LockTurret() {
    _isLocked = true;
}

void SubTurret::UnlockTurret() {
    _isLocked = false;
}

frc2::CommandPtr SubTurret::ZeroTurretCmd() {
    return RunOnce( [this] {
        ZeroTurret();
    });
}

units::degree_t SubTurret::getEncoder1Degrees() {
    return _encoderIO->GetEncoder1Degrees();
}

units::degree_t SubTurret::getEncoder2Degrees() {
    return _encoderIO->GetEncoder2Degrees();
}

bool SubTurret::IsAtTarget() {
    return units::math::abs(_turretMotor.GetPosError()) < TOLARANCE;
}

bool SubTurret::IsNotApproachingMax(std::function<units::millisecond_t()> time) {
    units::degree_t futureTurretAngle = GetTurretAngle() + _turretMotor.GetVelocity() * time();
    bool isNotApproachingMax = futureTurretAngle < POS_LIMIT || futureTurretAngle > NEG_LIMIT;
    Logger::Log("SOTM/FutureTurretAngle", futureTurretAngle);
    Logger::Log("SOTM/TurretIsNotApproachingMax", isNotApproachingMax);
    return (isNotApproachingMax);
}

units::degree_t SubTurret::GetFieldRelativeTurretAngle() {
    auto robot = PoseHandler::GetInstance().GetPose();
    return robot.Rotation().Degrees() + GetTurretAngle();
}

void SubTurret::SetBrakeMode(bool brakeMode){
    rev::spark::SparkBaseConfig _neutralModeConfig;
    if (brakeMode == true) {
        _neutralModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);
        _turretMotor.AdjustConfigNoPersist(_neutralModeConfig);
    } else if (brakeMode == false) {
        _neutralModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kCoast);
        _turretMotor.AdjustConfigNoPersist(_neutralModeConfig);
    }
}

units::degree_t SubTurret::GetLastFieldRelativeTarget() {
    return _lastFieldRelativeTurretTarget;
}

void SubTurret::SetLastFieldRelativeTarget(units::degree_t angle) {
    _lastFieldRelativeTurretTarget = angle;
}