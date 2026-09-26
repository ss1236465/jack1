// Joint angles and palm-relative distances work with either hand and wrist rotation.
export function recognizeDigit(lm){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
  const straight=(a,b,c)=>{
    const u=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)];
    const v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];
    return u.reduce((s,x,i)=>s+x*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)||1)<-.72;
  };
  const palm=Math.max(distance(lm[0],lm[9]),.025);
  const extended=[5,9,13,17].map(b=>straight(lm[b],lm[b+1],lm[b+3])&&distance(lm[b+3],lm[0])>distance(lm[b+1],lm[0])+palm*.15);
  const thumb=straight(lm[1],lm[2],lm[4])&&distance(lm[4],lm[5])>palm*.55;
  const [index,middle,ring,pinky]=extended;
  if(index&&!middle&&!ring&&!pinky&&!thumb)return 1;
  if(index&&middle&&!ring&&!pinky&&!thumb)return 2;
  if(extended.every(Boolean)&&thumb)return 5;
  return 0;
}

export function createGestureSequence(){
  let candidate=null,since=0,stable=null,step=0,deadline=0,lastSeen=0,loveUntil=0,text='';
  const reset=()=>{candidate=null;stable=null;step=0;deadline=0;loveUntil=0;text='';};
  return {
    reset,
    update(digit,now){
      if(step&&now>deadline)step=0;
      if(loveUntil&&now>=loveUntil){loveUntil=0;text='';stable=null;}
      if(digit===null){
        candidate=null;
        if(now-lastSeen>800){step=0;stable=null;if(!loveUntil)text='';}
        return text;
      }
      lastSeen=now;
      if(candidate!==digit){candidate=digit;since=now;}
      if(now-since<300||stable===digit)return text;
      stable=digit;
      if(loveUntil)return text;
      if(digit===1){step=1;deadline=now+5000;text='1';}
      else if(digit===2){step=step===1?2:0;deadline=now+5000;text='2';}
      else if(digit===5){
        text=step===2?'中秋快乐':'';
        if(step===2)loveUntil=now+6000;
        step=0;
      }else{step=0;text='';}
      return text;
    }
  };
}
