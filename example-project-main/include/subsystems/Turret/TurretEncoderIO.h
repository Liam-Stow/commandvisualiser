#pragma once

#include <units/angle.h>

class TurretEncoderIO {
    public:
        virtual void ConfigEncoder() = 0;
        virtual units::degree_t GetEncoder1Degrees() = 0;
        virtual units::degree_t GetEncoder2Degrees() = 0;
        virtual units::degree_t GetRawEncoder1() = 0;
        virtual units::degree_t GetRawEncoder2() = 0;
        virtual bool IsConnected() = 0;
};