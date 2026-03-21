#include "subsystems/Turret/TurretCancoderIO.h"
#include "subsystems/Turret/TurretEncoderConfig.h"
#include "utilities/Logger.h"

TurretCancoderIO::TurretCancoderIO(int encoder1ID, int encoder2ID) : _encoder1(encoder1ID), _encoder2(encoder2ID) {}

void TurretCancoderIO::ConfigEncoder() {
    _encoderConfig.MagnetSensor.SensorDirection = ctre::phoenix6::signals::SensorDirectionValue::Clockwise_Positive;
    _encoderConfig.MagnetSensor.AbsoluteSensorDiscontinuityPoint = 1_tr;
    _encoder1.GetConfigurator().Apply(_encoderConfig);
    _encoder2.GetConfigurator().Apply(_encoderConfig);
}

units::degree_t TurretCancoderIO::GetEncoder1Degrees() {
    return _encoder1.GetAbsolutePosition().GetValue() - TurretCancoderConfig::encoder1ZeroOffset;
}

units::degree_t TurretCancoderIO::GetEncoder2Degrees() {
    return _encoder2.GetAbsolutePosition().GetValue() - TurretCancoderConfig::encoder2ZeroOffset;
}

units::degree_t TurretCancoderIO::GetRawEncoder1() {
    return _encoder1.GetAbsolutePosition().GetValue();
}

units::degree_t TurretCancoderIO::GetRawEncoder2() {
    return _encoder2.GetAbsolutePosition().GetValue();
}

bool TurretCancoderIO::IsConnected() {
    return _encoder1.IsConnected() && _encoder2.IsConnected();
}