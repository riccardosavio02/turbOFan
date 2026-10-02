#!/bin/sh
# Scarica i report NASA del GE E3 da NTRS in refs/
cd "$(dirname "$0")/../refs" 2>/dev/null || { mkdir -p "$(dirname "$0")/../refs" && cd "$(dirname "$0")/../refs"; }
while read -r name id; do
  [ -f "${name}__${id}.pdf" ] && continue
  curl -fsSL -A "Mozilla/5.0" -o "${name}__${id}.pdf" "https://ntrs.nasa.gov/api/citations/${id}/downloads/${id}.pdf" && echo "ok  $name" || echo "ERR $name"
done <<LIST
CR-168219_FPS_final_design 19900019242
CR-135444_preliminary_design 19780023165
CR-159584_aircraft_integration 19810013521
CR-165148_fan_detailed_design 19830008070
CR-168070_fan_performance 19850025828
CR-165558_HPC_detail_design 19850002690
HPC_test_hardware_design 19900019254
CR-169301_combustor_design 19900019238
CR-167955_HPT_detailed_design 19850002687
HPT_performance_SCANNED 19900019237
LPT_detailed_design 19850002686
CR-168069_core_design_performance 19900019243
CR-168017_controls_accessories 19850021645
LIST
