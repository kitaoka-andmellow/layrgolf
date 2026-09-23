import importlib.util, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sync', ROOT/'scripts'/'sync_gora_api.py')
m=importlib.util.module_from_spec(spec); sys.modules[spec.name]=m; spec.loader.exec_module(m)
search=json.loads((ROOT/'fixtures'/'search_api_sample.json').read_text(encoding='utf-8'))
items=m.api_items(search)
assert len(items)==1 and items[0]['golfCourseId']==280041
row=m.normalize(items[0],28,'兵庫県','search')
assert row['gora_course_id']==280041 and row['prefecture']=='兵庫県'
detail=json.loads((ROOT/'fixtures'/'detail_api_sample.json').read_text(encoding='utf-8'))
di=m.api_detail_item(detail)
row2=m.normalize(di,8,'茨城県','detail')
flags=m.dress_flags(row2.get('dress_code_raw',''), row2.get('shoes_raw',''))
assert flags['denim_banned']==1 and flags['tshirt_banned']==1 and flags['sandals_banned']==1
row2.update(flags)
score,label=m.difficulty(row2)
assert score is not None and label in {'FRIENDLY','TACTICAL','CHALLENGING'}
print('OK')
