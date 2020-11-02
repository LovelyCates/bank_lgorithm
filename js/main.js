layui.use("form", function () {
  let form = layui.form;
  form.render();
  // 开始写函数
  // 1. 资源数
  let available = new Array();
  // 2. 稳定初始资源值
  let initial_available = new Array();
  // 2. 最大资源需求
  let max = new Array();
  // 3. 已经分配的资源
  let allocation = new Array();
  // 4. 还需要的资源
  let need = new Array();
  // 5.存放需求
  let request = new Array();
  // 线程号
  let thread;
  let history = -1;
  // 7. 那个刷新
  let update = 0; // 默认是为 1，0-> 自己填写, 1 -> 随机分配, 2-> 书上例子指定分配
  // 8. 进程名 x 资源名 x 那个名
  let zimu;
  let process;
  // 8.5 记录分配过程已经完成了的进程
  let dis_finish_process = new Array();
  const zi = new Array(
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L"
  );
  const pro = new Array(
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p6",
    "p7",
    "p8",
    "p9",
    "p10",
    "p11",
    "p12"
  );
  // 9. 已经运行完毕的进程
  let finish_process = new Array();
  // 10. 指定类型
  let Display = new Array(
    "类型展示：某类资源总和小于已经分配资源之和",
    "类型展示: 剩余资源不满足任何一个进程的需求",
    "类型展示: 剩余资源满足进程需求，但是系统不安全，找不到安全序列"
  );
  let display_count = 0;
  // 11. 重要标志！！！！！ 如果已经进行了分配活动，自动变为false,如果再重新赋值，置位 true
  let flag_if_dis;
  // #1 初始化各类的值
  function getData() {
    // 得到资源数量
    let resources_type_num = $("#resources_type").val();
    let zimu = new Array("A", "B", "C", "D", "E", "F", "G");
    zimu = zimu.slice(0, resources_type_num);
    for (let i = 0; i < resources_type_num; i++) {
      available[i] = parseInt($("#res_" + zimu[i]).val());
    }
    // 进程对三类资源的最大需求
    let table_th = new Array("Max", "Allocation", "Need");
    let process_type_num = $("#process").val();
    var_help(resources_type_num, process_type_num);
    for (let i = 0; i < process_type_num; i++) {
      max[i] = new Array();
      for (let j = 0; j < resources_type_num; j++) {
        max[i][j] = parseInt(
          $("#" + table_th[0] + "_" + process[i] + "_" + zimu[j]).val()
        );
      }
    }
    // 进程已经分配的
    for (let i = 0; i < process_type_num; i++) {
      allocation[i] = new Array();
      for (let j = 0; j < resources_type_num; j++) {
        allocation[i][j] = parseInt(
          $("#" + table_th[1] + "_" + process[i] + "_" + zimu[j]).val()
        );
      }
    }
    // 进程还需要的三类资源数
    for (let i = 0; i < process_type_num; i++) {
      need[i] = new Array();
      for (let j = 0; j < resources_type_num; j++) {
        need[i][j] = max[i][j] - allocation[i][j];
        $("#" + table_th[2] + "_" + process[i] + "_" + zimu[j]).val(need[i][j]);
      }
    }
    // 初始化
    for (let i = 0; i < process_type_num; i++) {
      finish_process[i] = false;
    }
    // 找到need[i][j] 全为 0 的，然后删除其配置
    let count = 0;
    for (let i = 0; i < process_type_num; i++) {
      let temp = true;
      for (let j = 0; j < resources_type_num; j++) {
        if (need[i][j] !== 0) temp = false;
      }
      if (temp) {
        // 这个进程 pi+1已经运行完毕
        finish_process[i] = true;
      }
    }
    // 重新计算available
    for (let i = 0; i < resources_type_num; i++) {
      // 如果进程已经运行完毕，则不需要再加。
      for (let j = 0; j < process_type_num; j++) {
        if (finish_process[j]) {
          continue;
        }
        available[i] -= allocation[j][i];
      }
    }
  }

  //thread线程请求响应后，试探性分配资源
  function changeData(thread) {
    let resources_type_num = $("#resources_type").val();
    for (let i = 0; i < resources_type_num; i++) {
      // 重新调整系统资源数
      available[i] -= request[i];
      // 计算各个线程拥有的资源
      allocation[thread][i] += request[i];
      //重新计算需求
      need[thread][i] -= request[i];
    }
  }

  // 安全性检查为通过，分配失败时调用，恢复系统原状
  function recoverData(thread) {
    let resources_type_num = $("#resources_type").val();
    for (let i = 0; i < resources_type_num; i++) {
      // 重新调整系统资源数
      available[i] += request[i];
      // 计算各个线程拥有的资源
      allocation[thread][i] -= request[i];
      //重新计算需求
      need[thread][i] += request[i];
    }
  }

  // 对线程 thread 进行安全性检测
  function check(thread, judge) {
    // 资源 x 进程数
    let resources_type_num = $("#resources_type").val();
    let process_type_num = $("#process").val();
    var_help(resources_type_num, process_type_num);
    let finish = new Array();
    let work = new Array();
    let queue = new Array(); // 存放安全队列
    let k = 0; // 安全队列下标
    let j; // 要判断的线程
    let i;

    // 找到need[i][j] 全为 0 的，然后删除其配置
    let count_index = 0;

    // 是否分配的标志
    for (i = 0; i < process_type_num; i++) {
      finish[i] = false;
      if (dis_finish_process[i]) finish[i] = true;
    }

    if (!judge) {
      // 将已经为 0 的置为 true，并且先报到一下
      let str = "找前检测：";
      //  alert(finish_process.length);
      for (i = 0; i < finish_process.length; i++) {
        if (!finish_process[i]) continue;
        str += "进程 ";
        str += process[finish_process[i]];
        str += " 已经执行完毕;";
        finish[finish_process[i]] = true;
        if (i === finish_process.length - 1) {
          $("#show_history").append("<p>" + str + "</p>");
        }
      }
    }
    j = thread;
    for (i = 0; i < resources_type_num; i++) {
      work[i] = available[i];
    }

    // 再创建一个判断
    let output_flag = true;
    for (i = 0; i < resources_type_num; i++) {
      if (need[thread][i] !== 0) output_flag = false;
    }

    // 算了，str写这里
    let output_str = "";
    while (j < process_type_num) {
      //
      for (i = 0; i < resources_type_num; i++) {
        //
        if (finish[j]) {
          j++;
          break;
        } else if (need[j][i] > work[i]) {
          j++;
          break;
        } else if (i === resources_type_num - 1) {
          if (judge && j === thread && output_flag) {
            $("#show_history").append(
              "<p>进程" +
                process[thread] +
                " 获取分配资源, 并且满足, 执行完毕后释放资源</p>"
            );
          } else {
            $("#show_history").append(
              "<p>剩余资源量为<b style='color: greenyellow'>" +
                work +
                "</b> 满足进程" +
                process[j] +
                "的" +
                "需求资源量: " +
                need[j] +
                "。分配然后执行，完毕后获取其初始分配资源量" +
                allocation[j] +
                "</b>"
            );
            queue[k] = j;
            //
            output_str = output_str + process[j] + "->";
          }

          for (let m = 0; m < resources_type_num; m++) {
            work[m] += allocation[j][m];
          }
          finish[j] = true;
          k++;
          j = 0;
        }
      }
    }
    //判断是否都属于安全状态
    for (let p = 0; p < process_type_num; p++) {
      if (finish[p] === false) {
        $("#show_history").append(
          "<p style='color: red'>" + "系统找不到任何一条安全序列 =-=" + "</p>"
        );
        return false;
      }
    }
    // 系统安全
    output_str += "结束";
    // 找到
    let out_str =
      "然后测试最后获取总资源量为<p style='color: #f4606c'>" +
      work +
      "</p>刚好等于初始总资源量（ps.见左边N类资源输入栏目）。<br/>所以系统安全且找到一条安全序列为: ";
    out_str += output_str;
    // 判断一下
    let zero_judge = true;
    for (let i = 0; i < resources_type_num; i++) {
      if (need[thread][i] !== 0) {
        zero_judge = false;
      }
    }

    // 这个进程已经运行完毕
    if (zero_judge && judge) {
      for (let j = 0; j < resources_type_num; j++)
        available[j] += allocation[thread][j];
    }

    // 没有运行完毕 就....
    $("#show_history").append("<p>" + out_str + "</p>");
    // 是否需要重新定义
    let flag = true;
    nomarl_value(
      resources_type_num,
      process_type_num,
      max,
      allocation,
      available,
      initial_available,
      need,
      form,
      flag
    );
    return true;
  }

  // 用户输入要申请资源的线程和申请的资源，并进行判断
  function getThread(tag = false) {
    // 申请资源的线程
    let thread = parseInt($("#dis_process_op option:selected").val());
    // 资源 x 进程数
    let resources_type_num = $("#resources_type").val();
    let process_type_num = $("#process").val();
    var_help(resources_type_num, process_type_num);
    // 获取输入的资源
    for (let i = 0; i < resources_type_num; i++) {
      request[i] = parseInt($("#dis_" + zimu[i]).val());
    }

    if (tag) {
      thread = 0;
      for (let i = 0; i < resources_type_num; i++) {
        request[i] = 0;
      }
    }

    // 输出
    // 进行超出资源判断
    for (let i = 0; i < resources_type_num; i++) {
      if (request[i] > need[thread][i]) {
        $("#show_history").append(
          "<p style='color: red'>" +
            "线程申请的资源超出其需要的资源，系统不安全,请重新输入" +
            "</p>"
        );
        return;
      } else if (request[i] > available[i]) {
        $("#show_history").append(
          "<p style='color: red'>" +
            "线程申请的资源大于系统资源，系统不安全,请重新输入" +
            "</p>"
        );
        return;
      }
    }
    // 查找里面已经完成了的
    //let have_finished_process = new Array();
    for (let i = 0; i < process_type_num; i++) {
      let check_temp = true;
      for (let j = 0; j < resources_type_num; j++) {
        if (need[i][j] !== 0) check_temp = false;
      }
      dis_finish_process[i] = check_temp;
    }
    // 安全性检测
    changeData(thread);

    if (check(thread, true)) {
      $("#show_history").append("<p>安全性检测通过</p>");
    } else {
      recoverData(thread);
      // 查看 thread 的 need 三个是不是都为0
      let check_temp = true;
      for (let i = 0; i < resources_type_num; i++) {
        if (need[thread][i] !== 0) check_temp = false;
      }
      // 如果分配完成了，添加
      if (check_temp) {
        // 表示这个节点已经执行完毕。
        dis_finish_process[thread] = check_temp;
      }
      $("#show_history").append("<p>安全性检测未通过</p>");
    }
  }

  /* ----------------- 初始安全性检验 --------------------*/
  function initial_check() {
    getData();
    // 如果随机分配 或者 指定分配，则不用
    // 1. 先判断每个的进程的某类型现在的值是不是大于之后的
    $("#show_history").append(
      "<p>" + "进行动态表格allocation 与 max间的检测" + "</p>"
    );
    // 赋予 变量 i j
    let i, j;
    let resources_type_num = $("#resources_type").val();
    let process_type_num = $("#process").val();
    // 更改zimu, process
    var_help(resources_type_num, process_type_num);

    // 查看 ava
    for (i = 0; i < resources_type_num; i++) {
      if (available[i] < 0) {
        $("#show_history").append(
          "<p>" +
            "资源 " +
            zimu[i] +
            "小于当前已分配的同类型资源量，发生错误，系统不安全!" +
            "</p>"
        );
        return;
      }
    }
    // 进行检查剩余资源量是否至少满足其中一个的 且
    let dis_succeed_list = new Array();
    let dis_succeed = false;
    // 检验
    let dis_succeed_temp = new Array();
    for (i = 0; i < process_type_num; i++) {
      for (j = 0; j < resources_type_num; j++) {
        // 初始
        dis_succeed_list[j] = false;
        // 判断
        if (available[j] >= need[i][j]) dis_succeed_list[j] = true;
        // 如果超了
        if (allocation[i][j] > max[i][j]) {
          $("#show_history").append(
            "<p>" +
              "进程 " +
              process[i] +
              " 分配的 " +
              zimu[i] +
              " 资源量大于其最大需求，所以系统不安全，请重新输入相关值" +
              "</p>"
          );
          return;
        }
      }
      let temp = true;
      for (let j = 0; j < resources_type_num; j++) {
        if (dis_succeed_list[j] === false) temp = false;
      }
      dis_succeed_temp[i] = temp;
    }
    // 如果都不满足
    for (let j = 0; j < resources_type_num; j++) {
      if (dis_succeed_temp[j] === true) {
        dis_succeed = true;
        break;
      }
    }
    if (!dis_succeed) {
      $("#show_history").append(
        "<p>" +
          "当前情况，剩余资源量 " +
          available +
          "已经不满足任何一个进程的需要，系统发生死锁, 所以系统不安全" +
          "</p>"
      );
      return;
    }
    // 如果满足一个，或多个，就check，尝试为某个进程分配一个 0 0 0 0
    for (i = 0; i < resources_type_num; i++) {
      request[i] = 0;
    }
    $("#show_history").append("<p>" + "开始寻找安全序列" + "</p>");
    check(0, false);
  }

  /* --------------------------历史 -----------------------*/
  function show_history_line() {
    // 显示出来
    // 根据 dis_history一条条显示数据
    for (let i = 0; i < dis_history.length; i++) {
      sleep(output(i), 1000);
    }
  }

  function output(i) {
    $("#show_history").append("<p>" + dis_history[i] + "</p>");
  }

  function sleep(callback, time) {
    if (typeof callback === "function") setTimeout(callback, time);
  }

  /* -----------------------------------主函数 --------------------*/
  // evt: 哪个按钮点击的 =-=
  function Main(evt) {
    // m.1 随机生成
    if (evt === "random") {
      // m.1.1 添加到历史
      flag_if_dis = true;
      update = 0;
      $("#show_history").empty();
      $("#history_title").css("display", "block");
      $("#show_history").append(
        "<p>" + "开始根据进程数和资源类型数随机分配" + "</p>"
      );
      let process_type_num = $("#process").val();
      for (let i = 0; i < process_type_num; i++) {
        dis_finish_process[i] = false;
      }
      random_val();
    } else if (evt === "normal") {
      // m.1.2
      flag_if_dis = true;
      $("#show_history").empty();
      if (display_count >= 3) {
        $("#show_history").append(
          "<p>" + "例子放完，开始根据进程数和资源类型数随机分配" + "</p>"
        );
        random_val();
      } else {
        $("#show_history").append("<p>" + Display[display_count++] + "</p>");
        normal_val();
      }
    } else if (evt === "initial_check") {
      // m.1.3
      $("#show_history").empty();
      $("#show_history").css("display", "block");
      $("#show_history").append("<p>" + "进行安全性检验" + "</p>");
      if (flag_if_dis) {
        initial_check();
      } else {
        getThread(true);
      }
    } else if (evt === "getThread") {
      flag_if_dis = false;
      $("#show_history").empty();
      getThread();
    }
  }

  /* -------------------------- 随机赋值 ----------------*/
  function random_val() {
    /* 条件
    1. 首先随机一些资源量，然后赋予每个类型的总资源为 > 最大的某个， < 总的 2/3
    2. 当前分配的，就全为 0, 1, 2, 然后 总资源 > 当前分配的
    3. 当前分配的，需要小于 最大需求
    4. 这个需要获取进程数和资源类数
    根据前面得到  */
    let process_type_num = $("#process").val();
    let resources_type_num = $("#resources_type").val();
    // 先动态生成当前值 + 最大值，最大值就是比当前值，多 0 或 1 或 2
    let i;
    let j;
    // 每个资源的最大需求值，当前已经分配的和值, 最大和
    let max_max = new Array();
    let allocation_sum = new Array();
    let max_sum = new Array();
    for (i = 0; i < process_type_num; i++) {
      max[i] = new Array();
      allocation[i] = new Array();
      need[i] = new Array();
      for (j = 0; j < resources_type_num; j++) {
        allocation[i][j] = getRndInteger(0, 3);
        max[i][j] = allocation[i][j] + getRndInteger(0, 2);
        need[i][j] = max[i][j] - allocation[i][j];
      }
    }
    for (i = 0; i < resources_type_num; i++) {
      let max_temp = 0;
      let allocation_temp = 0;
      let max_sum_temp = 0;
      for (j = 0; j < process_type_num; j++) {
        // 最大值
        if (max[j][i] > max_temp) max_temp = max[j][i];
        // 当前和
        allocation_temp += allocation[j][i];
        // 最大
        max_sum_temp += max[j][i];
      }
      max_max[i] = max_temp;
      allocation_sum[i] = allocation_temp;
      max_sum[i] = max_sum_temp;
    }
    // 根据前面的数据，动态生成需要资源
    for (i = 0; i < resources_type_num; i++) {
      // 首先得大于 allocation_sum, 也得大于 max_max[i]，也得小于 2/3 的max_sum[i]
      let floor_num = Math.max(max_max[i], allocation_sum[i]);
      // 然后小于 2/3
      let top_num = Math.floor((2 / 3) * max_sum[i]);
      // alert(top_num);
      available[i] = getRndInteger(
        getRndInteger(floor_num + 1, floor_num + 4),
        top_num
      );
    }
    // 顺便带个初始化 dis_process_succeed
    for (j = 0; j < available.length; j++) {
      initial_available[j] = available[j];
      dis_finish_process[j] = false;
    }
    nomarl_value(
      resources_type_num,
      process_type_num,
      max,
      allocation,
      available,
      initial_available,
      need,
      form,
      false
    );
  }

  /* ------------------------- 常规动态赋值 -------------------*/
  function normal_val() {
    // 得到进程数
    $("#process").val(4);
    // 得到资源数
    $("#resources_type").val(4);
    resources_type_num = 4;
    process_type_num = 4;
    var_help(resources_type_num, process_type_num);
    // 开始赋值
    if (display_count === 1) {
      max[0] = new Array(5, 2, 3, 4);
      max[1] = new Array(4, 3, 3, 4);
      max[2] = new Array(5, 4, 3, 2);
      max[3] = new Array(4, 4, 4, 3);
      allocation[0] = new Array(3, 0, 3, 3);
      allocation[1] = new Array(2, 1, 1, 2);
      allocation[2] = new Array(3, 3, 2, 2);
      allocation[3] = new Array(3, 3, 2, 3);
      need[0] = new Array(2, 2, 0, 1);
      need[1] = new Array(2, 2, 2, 2);
      need[2] = new Array(2, 1, 1, 0);
      need[3] = new Array(1, 1, 2, 0);
      available = new Array(12, 9, 9, 9);
    } else if (display_count === 2) {
      max[0] = new Array(2, 0, 2, 3);
      max[1] = new Array(3, 2, 1, 3);
      max[2] = new Array(0, 2, 5, 1);
      max[3] = new Array(2, 1, 3, 4);
      allocation[0] = new Array(2, 0, 0, 3);
      allocation[1] = new Array(3, 2, 0, 1);
      allocation[2] = new Array(0, 1, 3, 1);
      allocation[3] = new Array(1, 0, 3, 3);
      need[0] = new Array(0, 0, 2, 0);
      need[1] = new Array(0, 0, 1, 2);
      need[2] = new Array(0, 1, 2, 0);
      need[3] = new Array(1, 1, 0, 1);
      available = new Array(9, 5, 7, 8);
    } else if (display_count === 3) {
      max[0] = new Array(0, 4, 2, 1);
      max[1] = new Array(4, 2, 3, 0);
      max[2] = new Array(3, 0, 1, 2);
      max[3] = new Array(1, 4, 1, 3);
      allocation[0] = new Array(0, 3, 0, 0);
      allocation[1] = new Array(3, 1, 3, 0);
      allocation[2] = new Array(1, 0, 1, 2);
      allocation[3] = new Array(0, 3, 0, 3);
      need[0] = new Array(0, 1, 2, 1);
      need[1] = new Array(1, 1, 0, 0);
      need[2] = new Array(2, 0, 0, 0);
      need[3] = new Array(1, 1, 1, 0);
      available = new Array(6, 7, 6, 5);
    }
    // 顺便带个初始化 dis_process_succeed
    for (j = 0; j < available.length; j++) {
      initial_available[j] = available[j];
      dis_finish_process[j] = false;
    }
    nomarl_value(
      resources_type_num,
      process_type_num,
      max,
      allocation,
      available,
      initial_available,
      need,
      form,
      false
    );
  }

  /*--------------------- 按钮处理方式 --------------------- */
  // 1. 随机生成值
  $("#generate_auto_random").click(function () {
    Main("random");
  });
  // 2. 常规 - 书上例子赋值
  $("#generate_auto_normal").click(function () {
    Main("normal");
  });
  // 3. 初值安全性检验
  $("#generate_init_cal").click(function () {
    //  alert(dis_finish_process);
    Main("initial_check");
  });

  // 4. 分配验证
  $("#generate_init_dis_cal").click(function () {
    update++;
    Main("getThread");
  });
  /*-------------------- 辅助函数 ----------------------- */
  function var_help(resources_type_num, process_type_num) {
    zimu = zi.slice(0, resources_type_num);
    process = pro.slice(0, process_type_num);
  }
});

// 动态生成剩余资源量显示

// 随机 x 常规赋值 动态生成表格
function nomarl_value(
  resources_type_num,
  process_type_num,
  max,
  allocation,
  available,
  work,
  need,
  form,
  flag
) {
  // 先得到
  let zimu = new Array(
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "G",
    "K",
    "L",
    "M"
  );
  zimu = zimu.slice(0, resources_type_num);
  let process = new Array(
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p6",
    "p7",
    "p8",
    "p9",
    "p10",
    "p11",
    "p12",
    "p13"
  );
  process = process.slice(0, process_type_num);
  // 表头
  let table_th = new Array("Max", "Allocation", "Need");
  // 得到总的栏目数量，用百分比干
  let rate = Math.floor(1 / (1 + 3 * resources_type_num));
  // # 1. 资源量
  $(".input_resources_width").empty();
  $(".input_resources_th").empty();
  $(".input_resources_tb").empty();
  $("#input_resources").css("display", "block");
  $("#input_resources_title").css("display", "block");
  $(".input_resources_th").append("<th>资源属性</th>");
  $(".input_resources_tb").append("<td>资源量</td>");
  for (let i = 0; i < resources_type_num; i++) {
    $(".input_resources_width").append("<col style='width:" + 150 + ";'/>");
    $(".input_resources_th").append(
      "<th  style='text-align: center'>" + zimu[i] + "</th>"
    );
    $(".input_resources_tb").append(
      "<td style='text-align: center; width: " +
        rate +
        "%;'><input value='" +
        work[i] +
        "' style='text-align: center;' id='res_" +
        zimu[i] +
        "'  class='layui-input' name='res_" +
        zimu[i] +
        "'/></td>"
    );
  }
  let colors = new Array("#19CAAD", "#D1BA74", "#ECAD9E");
  // # 2. 总表
  $(".input_process_th").empty();
  $(".second_process_th").empty();
  $(".input_process_tb").empty();
  $("#input_process").css("display", "block");
  $("#input_process_title").css("display", "block");
  $(".input_process_th").append(
    "<th rowspan='2' style='text-align: center'>进程</th>"
  );
  for (let i = 0; i < table_th.length; i++) {
    // 添加表头
    $(".input_process_th").append(
      "<th style='text-align: center; color:" +
        colors[i] +
        "' colspan='" +
        resources_type_num +
        "'>" +
        table_th[i] +
        "</th>"
    );
    // 再，添加第二级表头
    for (let j = 0; j < resources_type_num; j++) {
      $(".second_process_th").append(
        "<th style='text-align: center; color:" +
          colors[i] +
          "'>" +
          zimu[j] +
          "</th>"
      );
    }
  }
  let res = new Array();
  res[0] = max;
  res[1] = allocation;
  res[2] = need;
  // 再接下来根据进程数，一层层添加
  for (let i = 0; i < process_type_num; i++) {
    // 添加一层 tr
    $(".input_process_tb").append("<tr class='tr_" + process[i] + "'></tr>");
    $(".tr_" + process[i]).append(
      "<td style='text-align: center'>" + process[i] + "</td>"
    );
    // 在这层里面进行循环添加
    for (let j = 0; j < table_th.length; j++) {
      for (let k = 0; k < resources_type_num; k++) {
        $(".tr_" + process[i]).append(
          "<td style='text-align: center; width: " +
            rate +
            "%; color:" +
            colors[i] +
            "'><input value='" +
            res[j][i][k] +
            "' style='text-align: center;color:" +
            colors[j] +
            "' id='" +
            table_th[j] +
            "_" +
            process[i] +
            "_" +
            zimu[k] +
            "' class='layui-input' name='" +
            table_th[j] +
            "_" +
            process[i] +
            "_" +
            zimu[k] +
            "'/> </td>"
        );
      }
    }
  }

  // # 3. 分配位置的产生
  $(".dis_process_th").empty();
  $(".dis_process_th_second").empty();
  $(".dis_process_tb").empty();
  $("#dis_process").css("display", "block");
  $("#dis_process_title").css("display", "block");
  $("#generate_init_dis_cal").css("display", "block");
  // 选择进程
  $(".dis_process_th").append("<th rowspan='2'>选择进程</th>");
  $(".dis_process_th").append(
    "<th colspan='" +
      resources_type_num +
      "' style='text-align: center'>分配</th>"
  );
  // 添加
  for (let i = 0; i < resources_type_num; i++) {
    $(".dis_process_th_second").append(
      "<th style='text-align: center'>" + zimu[i] + "</th>"
    );
  }

  $(".dis_process_tb").append(
    "<td><select id='dis_process_op' class='dis_process_op'></select></td>"
  );
  //再第二行，第一个进行选择
  for (let i = 0; i < process_type_num; i++) {
    $("#dis_process_op").append(
      "<option value='" + i + "'>" + process[i] + "</option>"
    );
  }
  // 进行后面的补空
  for (let i = 0; i < resources_type_num; i++) {
    $(".dis_process_tb").append(
      "<td><input style='text-align: center; width: 60px;' id='dis_" +
        zimu[i] +
        "' class='layui-input' name='dis_" +
        zimu[i] +
        "'/> </td>"
    );
  }
  form.render("select");

  // #4.剩余的显示
  // 重新计算available
  if (!flag) {
    for (let i = 0; i < resources_type_num; i++) {
      for (let j = 0; j < process_type_num; j++) {
        available[i] -= allocation[j][i];
      }
    }
  }
  // 清空
  $(".show_resources_th").empty();
  $(".show_resources_tb").empty();
  // 显示
  $("#show_available_num").css("display", "block");
  // 添加
  $(".show_resources_th").append("<th></th>");
  $(".show_resources_tb").append(
    "<td style='text-align: center; '>剩余可用</td>"
  );
  for (let i = 0; i < resources_type_num; i++) {
    $(".show_resources_th").append(
      "<th style='text-align: center;'>" + zimu[i] + "</th>"
    );
    $(".show_resources_tb").append(
      "<td style='text-align: center;'>" + available[i] + "</td>"
    );
  }
}

// 随机数
function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 外围检测
function init_check_main() {}
