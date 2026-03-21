#pragma once

#include <units/frequency.h>
#include <units/angle.h>

namespace TurretThroughboreConfig {
    static constexpr units::hertz_t ENCODER_FREQUENCY = 975.6_Hz;
    const units::turn_t encoder1ZeroOffset = 0.696408_tr;
    const units::turn_t encoder2ZeroOffset = 0.120609_tr;
}

namespace TurretCancoderConfig {
    const units::turn_t encoder1ZeroOffset = 0.923828_tr;
    const units::turn_t encoder2ZeroOffset = 0.680908_tr;
}
