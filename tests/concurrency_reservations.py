import os,subprocess,json,uuid,concurrent.futures,time
assert os.environ.get('JD_ALLOW_ISOLATED_RECIPE') == '1', 'Run only in a disposable PostgreSQL sandbox'
assert not os.environ.get('PGHOST'), 'Remote database targets are forbidden'

base=['runuser','-u','postgres','--','psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-d','postgres']
def sql(q):
 r=subprocess.run(base,input=q,text=True,capture_output=True,timeout=30)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
sql('drop schema public cascade; create schema public; drop schema auth cascade;')
sql(open(os.path.join(os.path.dirname(__file__), 'fixtures/reservation_snapshot.sql')).read())
results=[]
for scenario,baseline,limit in [('standard_stock',0,1),('standard_daily',0,1),('vip_mixed',111,112),('black_card',55,56)]:
 code='day_sat' if scenario.startswith('standard') else 'vip_sat' if scenario=='vip_mixed' else 'black_card'
 e,p,u,o=[str(uuid.uuid4()) for _ in range(4)]
 sql(f"""insert into events(id,title,city,starts_on,ends_on,capacity,tickets_open) values('{e}','Isolated recipe','Paris','2027-03-13','2027-03-14',6000,true);
 insert into event_daily_capacity values('{e}','2027-03-13',{1 if code=='day_sat' else 6000});
 insert into ticket_products(id,event_id,code,name,price_cents,access_date,stock_total,reserved_count) values('{p}','{e}','{code}','Isolated product',4000,'2027-03-13',{limit if scenario in ('standard_stock','black_card') else 'null'},{baseline});
 """)
 alt=p
 if scenario=='vip_mixed':
  alt=str(uuid.uuid4())
  sql(f"insert into event_daily_capacity values('{e}','2027-03-14',6000); insert into ticket_products(id,event_id,code,name,price_cents,access_days) values('{alt}','{e}','vip_two_days','VIP weekend',18000,2);")
 if baseline:
  sql(f"""insert into ticket_orders(id,user_id,event_id,customer_email) values('{o}','{u}','{e}','fixture@example.invalid');
  insert into ticket_order_items(order_id,product_id,product_code,product_name,unit_price_cents,quantity) values('{o}','{p}','{code}','Fixture',4000,{baseline});""")
 count=20
 import threading
 barrier=threading.Barrier(count)
 def reserve(i):
  barrier.wait()
  cart=json.dumps([{'productId':alt if i%2 else p,'quantity':1}])
  started=time.monotonic()
  out=sql(f"""begin; select public.create_ticket_order_reserved('{u}','{e}','isolated@example.invalid','{cart}'::jsonb,null); select pg_sleep(0.35); commit;""")
  r=json.loads(next(line for line in out.splitlines() if line.startswith('{')))
  r['elapsed']=round(time.monotonic()-started,3)
  return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=count) as ex:
  rs=list(ex.map(reserve,range(count)))
 winners=[r for r in rs if r['ok']]
 failures=[r for r in rs if not r['ok']]
 assert len(winners)==1,(code,rs)
 assert len(failures)==19
 final=int(sql(f"select sum(reserved_count) from ticket_products where event_id='{e}'"))
 assert final==limit,(code,final)
 orders=int(sql(f"select count(*) from ticket_orders where event_id='{e}'"))
 assert orders==1+(1 if baseline else 0),(code,orders)
 assert max(r['elapsed'] for r in rs)>1.0,rs
 results.append({'case':scenario,'simultaneous_requests':20,'accepted':1,'refused':19,'final_reserved':final,'limit':limit,'max_duration_seconds':max(r['elapsed'] for r in rs),'errors':sorted(set(r['error'] for r in failures))})
print(json.dumps({'database':'isolated PostgreSQL 18','production_data_used':False,'results':results}))
