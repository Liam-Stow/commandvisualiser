#include "subsystems/Turret/TurretThroughboreIO.h"
#include "subsystems/Turret/TurretEncoderConfig.h"
#include "utilities/Logger.h"

TurretThroughboreIO::TurretThroughboreIO(int encoder1ID, int encoder2ID) : _encoder1(encoder1ID), _encoder2(encoder2ID) {}

void TurretThroughboreIO::ConfigEncoder() {
    _encoder1.SetAssumedFrequency(TurretThroughboreConfig::ENCODER_FREQUENCY);
    _encoder2.SetAssumedFrequency(TurretThroughboreConfig::ENCODER_FREQUENCY);
}

units::degree_t TurretThroughboreIO::GetEncoder1Degrees() {
    return _encoder1.Get() * 1_tr - TurretThroughboreConfig::encoder1ZeroOffset;
}

units::degree_t TurretThroughboreIO::GetEncoder2Degrees() {
    return _encoder2.Get() * 1_tr - TurretThroughboreConfig::encoder2ZeroOffset;
}

units::degree_t TurretThroughboreIO::GetRawEncoder1() {
    return _encoder1.Get() * 1_tr;
}

units::degree_t TurretThroughboreIO::GetRawEncoder2() {
    return _encoder2.Get() * 1_tr;
}

bool TurretThroughboreIO::IsConnected() {
    return _encoder1.IsConnected() && _encoder2.IsConnected();
}