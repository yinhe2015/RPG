#!/usr/bin/env python3
"""Import the official, pinned C-Eval middle/high school subsets. Requires pyarrow."""
import argparse
import collections
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = '617524a00b307ff6f9933702f724131fe12ca7ce'
REPO = 'ceval/ceval-exam'
SUBJECTS = {
    'high_school_chinese': ('chinese', 2),
    **{f'{stage}_school_{name}': (subject, grade)
       for stage, grade in [('middle', 1), ('high', 2)]
       for name, subject in [('mathematics', 'math'), ('history', 'history'), ('geography', 'geography'), ('physics', 'physics')]},
}
# These are local, conservative keyword labels, not official C-Eval annotations.
TOPICS = {
 'chinese': [('字音字形', r'读音|注音|字形|错别字|拼音'), ('词语辨析', r'成语|词语|词义|熟语'), ('病句辨析', r'病句|语病'), ('文言阅读', r'文言|加点.*解释|实词|虚词'), ('诗词鉴赏', r'诗句|诗歌|古诗|词作|诗词'), ('修辞手法', r'修辞|比喻|拟人|排比'), ('语言表达', r'衔接|连贯|得体|语境|标点'), ('文学常识', r'文学|作家|作者|作品|小说|散文')],
 'math': [('概率统计', r'概率|随机|抽样|频率|方差|平均数|中位数|众数|统计|白球|黑球|放回|掷|骰|硬币'), ('数列', r'数列|等差|等比|通项'), ('三角函数', r'三角函数|sin|cos|tan|正弦|余弦'), ('导数与函数', r'导数|切线|极值|极大|极小'), ('圆锥曲线', r'椭圆|双曲线|抛物线|焦点'), ('立体几何', r'圆锥|圆柱|棱锥|棱柱|正方体|长方体|空间|球的|球面'), ('平面向量', r'向量'), ('集合与逻辑', r'集合|命题|充分|必要|复数'), ('函数', r'函数|单调|定义域|值域|对数|幂函数'), ('平面几何', r'三角形|四边形|正方形|矩形|菱形|圆|角|直线|线段|垂直|平行'), ('方程与不等式', r'方程|不等式'), ('数与式', r'计算|实数|分式|根式|因式|整数|有理数|科学记数')],
 'history': [('世界大战与国际格局', r'世界大战|二战|一战|冷战|苏联|苏俄|联合国|凡尔赛|北约'), ('中国近现代史', r'中国共产党|新中国|中华人民共和国|毛泽东|邓小平|改革开放|五四|辛亥|鸦片战争|洋务|维新|国民党|抗日|红军|土地改革|南京条约'), ('世界近现代史', r'工业革命|资本主义|文艺复兴|启蒙|华盛顿|拿破仑|英国|法国|美国|德国|俄国|欧洲'), ('中国古代史', r'秦|汉|唐|宋|元朝|明朝|清朝|春秋|战国|儒家|科举|孔子|孟子|商鞅'), ('世界古代史', r'罗马|希腊|雅典|埃及|巴比伦|封建|中世纪')],
 'geography': [('自然灾害与环境', r'灾害|地震|洪涝|泥石流|荒漠化|污染|生态|环境保护'), ('气候与天气', r'气候|气温|降水|季风|大气|天气|气压|锋面'), ('地球与地图', r'经纬|经度|纬度|地球|太阳|昼夜|自转|公转|地图|比例尺|等高线'), ('地形与地质', r'地形|地势|地质|岩石|地壳|板块|山脉'), ('水文与海洋', r'河流|河水|湖泊|海洋|洋流|水循环|流域|水资源'), ('人口与城市', r'人口|城市|城镇|聚落'), ('产业与交通', r'农业|工业|产业|交通|铁路|公路|运输|经济|旅游|粮食'), ('区域地理', r'地区|区域|国家|亚洲|欧洲|非洲|美洲|中国|我国|省|洲|大洋')],
 'physics': [('电磁学', r'电场|磁场|电荷|电势|磁通|电磁|感应|洛伦兹|安培'), ('电路与电能', r'电路|电流|电压|电阻|电功|电能|电灯|灯泡|电源|电热'), ('光学', r'光线|光学|透镜|折射|反射|成像|光速'), ('热学', r'热量|内能|温度|比热|气体|热机|熔化|蒸发|沸腾'), ('声与波', r'声音|声波|音调|响度|波长|频率|振动|机械波'), ('原子物理', r'原子|核反应|放射|半衰期|光电效应'), ('运动与力', r'运动|速度|加速度|牛顿|摩擦|重力|弹簧|受力|匀速|自由落体'), ('功与能', r'动能|势能|机械能|做功|功率|动量'), ('压强与浮力', r'压强|浮力|液体|密度')],
}
FALLBACK = {'chinese':'语文综合', 'math':'数学综合', 'history':'历史综合', 'geography':'地理综合', 'physics':'物理综合'}
MISSING_CONTEXT = re.compile(r'如[下上]?图|[下上左右该此]图|图中|图示|读图|看图|见图|附图|图[甲乙丙丁一二三四五六七八九\d①②③④]|下列.{0,5}图|如下表|下表|上表|表中|如表|读表|见表|表格|下列.{0,5}表[格示]|\\includegraphics|!\[[^\]]*\]\(|<img', re.I)


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def topic(subject, question):
    name = next((name for name, pattern in TOPICS[subject] if re.search(pattern, question)), FALLBACK[subject])
    return {'id': f'{subject}:{name}', 'name': name}


def convert(row, config, split):
    key = f'ceval:{config}:{split}:{row["id"]}'
    text = str(row.get('question') or '').strip()
    options = [str(row.get(letter) or '').strip() for letter in 'ABCD']
    letter = str(row.get('answer') or '').strip()
    if not text or not all(options) or letter not in 'ABCD' or len(letter) != 1:
        return None, (key, 'incomplete_or_missing_answer')
    if key in {'ceval:middle_school_mathematics:test:6', 'ceval:high_school_mathematics:test:112'}:
        return None, (key, 'missing_formula_or_variable')
    # Some source rows omit x/y entirely; an answer label cannot recover the condition.
    if re.search(r'关于\s*轴', text):
        return None, (key, 'missing_symmetry_axis')
    if len(set(options)) != 4:
        return None, (key, 'duplicate_options')
    if MISSING_CONTEXT.search(text + '\n' + '\n'.join(options)):
        return None, (key, 'missing_figure_or_table_context')
    if len(text) > 12000 or any(len(o) > 2000 for o in options):
        return None, (key, 'content_too_long')
    subject, grade = SUBJECTS[config]
    explanation = str(row.get('explanation') or '').strip()
    return {
        'id': key, 'subject': subject, 'grade': grade, 'type': 'choice',
        'difficulties': ['easy', 'normal', 'hard'],
        'knowledgePoint': topic(subject, text),
        'text': text, 'options': options, 'answer': options['ABCD'.index(letter)],
        'explanation': explanation or '本题原始数据未提供详细解析，可结合参考答案复习相关知识。',
        'hint': '先圈出题干的限定条件，逐一比较四个选项，再排除不符合条件的说法。',
        'source': {'dataset': REPO, 'revision': REVISION, 'config': config, 'split': split, 'id': row['id'],
                   'answerLabel': letter, 'hasExplanation': bool(explanation), 'topicMethod': 'local-keyword-v1', 'difficultyMethod': 'unrated'},
    }, None


def main():
    import pyarrow.parquet as pq
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=ROOT/'data/imports/ceval'/REVISION)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.cache_dir/'manifest.json'
    if not manifest_path.exists():
        manifest_path.write_bytes(download(f'https://huggingface.co/api/datasets/{REPO}/revision/{REVISION}'))
    manifest = json.loads(manifest_path.read_text())
    assert manifest['sha'] == REVISION
    files = sorted(x['rfilename'] for x in manifest['siblings'] if x['rfilename'].split('/')[0] in SUBJECTS and x['rfilename'].endswith('.parquet'))
    assert len(files) == len(SUBJECTS)*3, f'Expected three splits for each subset, got {len(files)} files'

    def fetch(path):
        target = args.cache_dir/path
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = download(f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{path}')
            temporary = target.with_suffix('.tmp')
            temporary.write_bytes(payload)
            temporary.replace(target)
        return path, hashlib.sha256(target.read_bytes()).hexdigest()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        hashes = dict(executor.map(fetch, files))
    questions, excluded, seen = [], [], set()
    totals = collections.Counter()
    for path in files:
        config, filename = path.split('/')
        split = filename.split('-')[0]
        rows = pq.read_table(args.cache_dir/path).to_pylist()
        totals[config] += len(rows)
        for row in rows:
            q, rejection = convert(row, config, split)
            if q:
                signature = (q['subject'], q['grade'], q['text'], tuple(q['options']))
                if signature in seen:
                    excluded.append((q['id'], 'duplicate_question'))
                    continue
                seen.add(signature)
                questions.append(q)
            else:
                excluded.append(rejection)
    bank = {
        'schemaVersion': 1, 'id': 'ceval-school', 'name': 'C-Eval · 中学学科题库',
        'description': '初高中数学、历史、地理、物理及高中语文。原版选择题；不含小学、英语和初中语文。难度调节战斗强度，题目未经逐题难度标定。',
        'source': 'C-Eval / Huang et al., NeurIPS 2023 · https://huggingface.co/datasets/ceval/ceval-exam · CC BY-NC-SA 4.0',
        'allowDerivedTypes': False, 'shuffleOptions': False, 'questions': questions,
    }
    output = ROOT/'question-banks/ceval-school.json'
    output.write_text(json.dumps(bank, ensure_ascii=False, indent=2)+'\n')
    counts = collections.Counter(q['source']['config'] for q in questions)
    report = {'dataset': REPO, 'revision': REVISION, 'downloaded': sum(totals.values()), 'imported': len(questions),
              'excluded': len(excluded), 'bySubset': {k:{'downloaded':totals[k], 'imported':counts[k]} for k in sorted(totals)},
              'excludedReasons': dict(collections.Counter(reason for _, reason in excluded)),
              'exclusions': [{'id':key, 'reason':reason} for key, reason in excluded], 'sha256':hashes}
    (ROOT/'docs/ceval-import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    licenses = ROOT/'docs/licenses';licenses.mkdir(exist_ok=True)
    license_path = licenses/'CEVAL-LICENSE-DATA.txt'
    if not license_path.exists():
        license_path.write_bytes(download('https://raw.githubusercontent.com/hkust-nlp/ceval/main/LICENSE-DATA'))
    print(json.dumps({k:v for k,v in report.items() if k not in ['exclusions', 'sha256']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
